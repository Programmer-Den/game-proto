# Lanternkeep: guide for agents

How Lanternkeep is built and where things stand, for agents changing it. README.md covers how to
play, the upgrade table and the numbers. Keep this file up to date with any change to the game, per
the root AGENTS.md.

## Current state

Lanternkeep is a real-time juggling game on one fixed screen, played as a shadow-puppet theatre: a
castle of black cut card in front of a backlit paper screen, with lantern spots and a jar of moths
at the gate. Tapping a lantern sends an idle moth to light it (or refill a lit one); a tap while
every moth is busy waits in a queue of two. The moths come in three kinds (fast, slow, heavy). Lit
lanterns burn oil and go dark when it runs out. When the 45 second dusk ends, the lanterns still
lit pay coins, and too few lit costs a hearth (a life). Each night has a herald's order (a bonus
goal), gusts that blow out a warned lantern unless a moth sits on it, and close-call refills that
pay at once. Every night after the first draws a kind (clear, foggy, feast, stormy), bats come for
lit lanterns from night 3 and are chased off by tapping them, and lanterns side by side form
chains that pay when all of them are lit at nightfall. Between nights a panel shows the tally,
the festival count, the next night's kind and seven upgrades (one buys fireflies, which light two
lanterns a flight) plus the Cask and Hearth cards; each night adds a lantern. Ten nights kept reach the
Great Festival, a win, with endless nights after. From night 2 cottage windows call for a lantern
(LK8), from night 3 refills draw on a cask of oil (LK9), from night 4 some spots hold a beacon, a
candle or a bell (LK6), every fifth night the Great Owl sweeps a row (LK7), and at every fifth
nightfall the keep can move to the Docks, Chapel Hill or the Market, each with its own spots,
chains and rule (LK10). From night 6 a moth rests after its fourth flight of a dusk (LK13), a
second jar can be bought (LK14), a lost hearth can be rekindled between nights (LK12), and every
nightfall from the tenth offers two curses that raise the pay (LK11).

Implemented today:

- One scene (`GameScene`): the paper screen crossfading from saffron through deep dusk to indigo
  with stars and a rising moon, the cut-card castle, lanterns with additive glow, flickering
  flames and oil bars, punched-hole rings (faint on a dark lantern, amber with a place badge on a
  queued one, filling while a moth lights one, pale blue while a moth guards one), moth puppets
  with a pale halo and dotted trails home, the herald's order card, the gust warning (wind curls,
  dashed ring, "Gust in Ns" plaque with a pointer), the "Save it +2c" tag and orange rings on
  nearly dry lanterns, popups ("+2c close call!" with a flare and sparks, "Shielded!",
  "Blown out!", "+5" per lantern and "+15 order kept" at nightfall), a HUD (night, hearths,
  coins, dusk bar with the queue count, lit count and quota), the night panel (tally, upgrades,
  "Next dusk"), a game-over panel ("New keep") and the Great Festival panel (sky lanterns,
  "Keep going"). Also the night-kind plaque (top right), mist (`fog`), bunting and rain layers,
  the chains' dotted cords (faint, amber when all lit), bat puppets with a dotted line to their
  lantern and a punched ring (pale blue once chased), and popups "Snuffed!", "Driven off!",
  "Chased off!" and "+8 chain".
- Shadow-puppet art, painted on 2D canvases at startup (`art/puppet.ts`, `pixelArt: false`),
  ported from the approved mockup's drawing script. Lettering is a system serif stack.
- Every text on screen follows the hub's Language setting: British English (the source), German,
  and US English, which spells every text the British way and so falls back to the source
  (`src/i18n/`, `docs/screenshots/german-dusk.webp`).
- Three moth kinds: `fast`, `slow` and `heavy`, cycling in jar order, so the first night's three
  moths are one of each. Each kind scales its speed, wick time and (heavy only) oil.
- Two-tap queue: a tap on an unclaimed lantern while every moth is busy waits (at most `QUEUE_MAX`
  = 2); a moth that comes home takes the oldest. The queue empties at nightfall.
- Herald's order: `ORDERS` (five, one a night in turn) of three goal kinds, `lit` (named lanterns
  lit at nightfall), `closeCalls` and `shields` (counts this dusk). Met at nightfall it adds its
  `reward` (15) to the night's pay.
- Gusts: `gustsFor(night)` gives the dusk-left times they hit (night 1 one, nights 2 and 3 two,
  then three). `GUST_WARN_MS` (5 s) before one, it picks the lit lantern with the most oil and
  sets `state.gust`; a moth lighting or guarding that lantern when it hits shields it, otherwise
  the lantern goes dark. A moth that finishes lighting the warned lantern stays on it (`guard`)
  until the gust passes.
- Close calls: a moth that reaches a lit lantern with under `CLOSE_CALL` (15%) of its oil marks a
  close call; when it finishes the refill the game pays `CLOSE_CALL_PAY` (2) coins at once. A
  lantern a moth sits on (lighting or guarding) burns no oil. A refill never lowers the oil: a
  moth whose fill is less than the oil left (a fast moth refilling a heavy moth's lantern) leaves
  it as it is and draws nothing from the cask.
- Nights without end: `lanternsFor` adds one lantern a night up to the ten in `LANTERN_SPOTS`.
- Kinds of night (LK1): `NIGHT_KINDS` (`clear`, `fog`, `feast`, `storm`). `drawKind` keeps night
  1 clear and draws later kinds with `Math.random` at the nightfall before (`state.nextKind`), so
  the panel can show it; `nextDusk` moves it to `state.kind`. Fog burns oil `FOG_BURN` (1.4x)
  faster, a feast multiplies the lantern pay, all-lit bonus and chains by `FEAST_PAY` (2, not the
  order), and a storm adds `STORM_GUSTS` (28 s and 16 s) through `gustsFor(night, kind)`.
- Bats (LK2): `batsFor(night)` gives the dusk-left times they come (none on nights 1 and 2, one on
  3 to 5, then two). A bat enters from a side edge at `BAT_Y`, flies at `BAT_SPEED` to the lit
  lantern with the most oil (re-targeting if that goes dark, leaving if none is lit) and snuffs
  it, unless a moth sits on it. `chase(s, id)` sends an idle moth (not a firefly if another is
  idle) with task `chase`; catching the bat makes it flee (`BAT_FLEE` times faster, off the top
  corner) and counts `state.chased`. A chase is never queued.
- Lantern chains (LK3): each district's `chains` in `places.ts`, four of three lanterns each. `chainsFor(s)` lists
  the chains whose lanterns all exist this night (none on night 1), `chainLit` whether one is all
  lit. Each lit at nightfall pays `CHAIN_BONUS` (8).
- Fireflies (LK4): the `firefly` upgrade (two levels) adds a `firefly` moth after the regular ones.
  `send` sends an idle firefly first. `dispatch` gives it `hops` = `FIREFLY_LANTERNS` - 1; after
  lighting, `nextHop` takes the oldest unclaimed queued tap or the nearest dark unclaimed lantern
  and it flies on (unless a gust makes it guard).
- The Great Festival (LK5): the nightfall that brings `kept` to `FESTIVAL_NIGHTS` (10) sets
  `state.festival`, `report.festival` and phase `'festival'`; `carryOn` moves on with `afterPanels`
  (`'move'` or `'peril'` in practice, as the festival comes at night 10 or later, and every such
  nightfall offers curses).
- Seven upgrades (five of three levels, Firefly of two, Jar of one), bought between nights, plus
  the Cask and Hearth cards. Only the most nights kept, the best peril multiplier and the trophies persist.
- Kinds of lantern (LK6): `LANTERN_KINDS` (`plain`, `beacon`, `candle`, `bell`), each with `oil`,
  `wick` and `pay` multipliers. `lanternKindsFor(night, count)` deals `min(LANTERN_KINDS_MAX,
  night - LANTERN_KINDS_NIGHT + 1)` special spots from `LANTERN_KINDS_NIGHT` (4), at indexes
  `(night * 7 + k * 4) % count` (the next free one if taken), cycling `SPECIAL_KINDS`. A candle's
  wick is 0 (`mothLightMs` is 0, the lighting completes on the next tick); a bell holds every bat
  within `BELL_RANGE` (150) still (`stunned(s, bat)`) while lit. `lanternPay(s, l)` gives a lit
  lantern's pay. The scene shows `lantern-<kind>-lit/-dark` textures and the kind's name under it.
- The Great Owl (LK7): `owlsFor(night)` is `[OWL_AT_MS]` (20 s left) every `OWL_EVERY` (5)
  nights. `OWL_WARN_MS` (6 s) before, `greatOwl` picks the row (`rows(s)`, lanterns grouped by
  `y`) with the most lit lanterns (ties: the bigger row) and sets `state.owl` (`y`, `lanterns`,
  `atMs`, `x` null); at `atMs` the owl flies from x -40 at `OWL_SPEED` (300 px/s) and each lantern
  of the row it passes is snuffed unless a moth sits on it (`owl` event, `shielded`). A moth that
  finishes lighting a lantern on the row guards it (`threatened(s, i)` covers the gust's target
  and the owl's row); `releaseGuards` sends the guards home when the owl leaves the screen.
- Windows that call (LK8): `callsFor(night)` gives the dusk-left times (none on night 1, 37 s and
  23 s after, 11 s too from night 6). `windows` picks `callTarget` (a dark, unclaimed, unqueued
  lantern from index `(night * 3 + callsKept + calls left) % count` on, else the lit unclaimed one
  lowest on oil while `caskSpare`, else no call) and sets `state.call` (`lantern`, `msLeft` = `CALL_MS`, 8 s). A moth that lights
  or refills that lantern in time pays `callPay(s)` (`CALL_PAY` 3, double in the market) at once
  and counts `callsKept`; running out pushes a `call` event with `kept` false and costs nothing.
- Oil cask (LK9): `state.cask` fills, `CASK_START` (3) to `CASK_MAX` (6). From `CASK_NIGHT` (3)
  (`usesCask(s)`) a refill draws one fill when the moth finishes lighting a lit lantern.
  `caskSpare(s, except?)` is false once every fill is reserved by moths flying to or refilling
  lit lanterns. A moth reserves a fill only as it leaves: `dispatch` sets the moth's `reserved` to
  `caskSpare && drawsFill` (its lantern is lit and its fill would add oil; a guard tap on a full
  lantern reserves none), and it never changes mid-flight, so no reservation appears on the way
  (a reserved moth whose lantern goes dark lights it free and gives the fill back). On landing a
  `reserved` moth draws its fill; one without (sent only to shield, or whose lantern burned down
  below its fill on the way) draws one only while `caskSpare(s, m)` holds, so a moth never takes a
  fill reserved for another, whichever lands first. `mayTap(s, i, except?)` allows a tap on a dark lantern, on a lit one while
  `caskSpare`, and on a lit one that is `threatened` (a gust or the owl coming for it), so it can
  always be shielded (a bat is chased instead): `send` refuses the rest, a queued refill is
  dropped (in `tick` and a firefly's `nextHop`) once `mayTap` is false, and the scene hides the
  "Save it" tag and rings when `caskSpare` is false. A moth sent to shield a threatened lantern
  that arrives to find the cask dry (or every fill reserved by other moths) pushes a `dry` event
  (its `clunk`, no `strike` or buzz) and leaves the lantern as it is (no close call), then guards
  it. `topUp(s)` in the night phase adds a fill for
  `CASK_COST` (3); the Cask card calls it. The HUD shows the cask at `CASK_HUD` (grey before night
  3, orange when dry).
- Districts (LK10): `DISTRICTS` in `places.ts` (`keep`, `docks`, `chapel`, `market`), each with
  ten `spots` (with `name`s for the orders), `chains` and a `rule` (`none`, `seawind`: `wind`
  blows a second lantern, the next with most oil; `vespers`: `lanternPay` adds `VESPERS_PAY` (2)
  and `requiredFor(count, district)` asks for `VESPERS_QUOTA` (0.75); `trade`: `closeCallPay` and
  `callPay` double and oil burns `TRADE_BURN` (1.15x)). `state.district` is the current one,
  `nextDistrict` the next; `nightfall` on a night divisible by `MOVE_EVERY` (5) sets `moveDue` and
  phase `'move'` (after `'festival'` if both; `carryOn` goes to `'move'` then), `moveTo(s, id)`
  picks and goes on with `afterPanels` (`'peril'` from night 10, else `'night'`), and `nextDusk` moves in and builds the lanterns from the district's
  spots. `orderFor(night)` gives the night's order; the scene's `describeOrder` shows its text in
  the keep and names the district's spots for a `lit` order elsewhere (`orderLit`). `districtOf(s)`, `chainsOf(s)` and `chainsFor` read the current district.
- Pick your peril (LK11): `nightfall` on a night with `night + 1 >= PERIL_NIGHT` (11) sets
  `state.offer` to two different `CURSES` (`wet`, `bats`, `thin`, `watch`, drawn by `drawOffer`
  with `Math.random`) and, after `'festival'` and `'move'` (`afterPanels`), phase `'peril'`.
  `takeCurse(s, id)` adds to `state.curses[id]` (lasting, stackable), drops it from the offer
  (phase `'night'` once both are taken) and raises `bestPeril`; `endPeril` leaves the rest.
  `perilMult(s)` = 1 + `PERIL_STEP` (0.25) per curse taken multiplies (and rounds) what each
  nightfall earns; `paidMult` keeps the one the last nightfall used. Effects: `WET_WICK` (1.5x)
  per Wet wicks in `mothLightMs`, `RESTLESS_BATS` times added by `batsFor(night, restless)`,
  `THIN_BURN` (1.25x) per Thin oil in `tick`, and one more lantern per Watchful lord in
  `required(s)` (capped at the count; use it rather than `requiredFor` for the night's quota).
- Rekindle a hearth (LK12): `hearthCost(s)` is `HEARTH_COSTS[rekindled]` (40, 80, 120) while a
  hearth is out, else null; `rekindle(s)` buys it in the night phase. The shop's Hearth card.
- Tired moths (LK13): `dispatch` from idle and `chase` count `moth.flights` (a firefly's next hop
  does not). From `TIRED_NIGHT` (6) a moth that gets home with `TIRED_FLIGHTS` (4) or more goes to
  task `rest` for `restMs(s)` (`TIRED_MS` 6 s less `NECTAR_MS` 1.5 s per `nectar` level) and its
  count starts again. The scene folds its wings, dims its halo and draws a lilac ring and a
  "zz Ns" label.
- The second jar (LK14): the `jar` upgrade (one level, 120). `JARS` in `places.ts` holds both
  jars; `state.homes[i]` says which moth rests where (kept across nights; `buy` sets every other
  moth to jar 1). `restOf(s, i)` spaces the moths of each jar on its rim (used by `makeMoths`, the
  flight home and idle moths, which glide to their spot when a jar's moths change).
  `swapJar(s, i)` sends an idle moth to rest at the other jar; the scene gives each moth a tap
  `Zone` (`MOTH_HIT`) only while it is idle on a jar with the second jar bought, and draws the
  `jar` texture at `JARS[1]`.

Missing or rough:

- No title screen of its own (the shared start and pause screens cover it). No ambience (crickets,
  rain): the storm's rain is only in its music. The kinds, bats, chains, fireflies, the festival, the window
  calls, the cask, the kinds of lantern, the owl, the districts, tired moths, the second jar,
  rekindling and the curses are not exercised by the
  playthrough (night 1 is clear with no bats, chains, calls, cask use or special lanterns), only
  by hand and the scratch staging script.
- The feast bunting is strung between the keep's towers in every district, so it floats over the
  other districts' buildings.
- Moths fly straight lines.
- The upgrade buttons are not exercised by the playthrough (purchases stay out of it), only by
  hand.
- Canvas `filter: blur` (the card's soft shadows and the far hills) is ignored by Safari, so those
  edges are hard there.

## Architecture

File map (`src/`):

- `howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English and German, picked with `byLanguage` (US English uses the British text) and handed to
  `setupGame(game, { howToPlay })` in `main.ts`; update both languages when the controls or the
  first round change.
- `i18n.ts` and `i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British English
  source and `i18n/de.ts` the German (with `keepEnglish` for a text that is the same); there is no
  `en-US.ts`, since no text spells differently in US English (add one, typed
  `Partial<Translation<typeof en>>`, and hand it to `translator` when one does). `t(key, vars)`
  shows a text in the hub's language; `TextKey` types the keys. Every text on screen goes through
  `t`, numbers through `formatNumber` (the scene's `mult2` for pay multipliers).
- `audio/sound.ts`: `sfx`, the game's sound table (`sounds` from `shared/audio.ts`), and `SONG`,
  its music. `audio/cues.ts`: when they play: `snapshot(s)` before `tick` and `frameSounds(before,
  s, events)` after it, `nightfallSounds`, and `updateMusic` (the part for the state, from
  `musicPart`). See Sound below.
- `trophies/`: the game's ten trophies (`shared/trophies.ts`). `index.ts` lists them (`trophies`:
  id, tier, icon, `hidden` for Keeper of the flame) with their texts in `trophies/i18n/` (`en.ts`,
  `de.ts` and `en-US.ts` for "Good neighbor": the name keyed by the id, what earns it by `<id>Text`), and imports nothing else
  from the game, since the hub loads it for its trophy shelf. `main.ts` hands `trophies` to
  `setupGame`, which lists them on the start and pause screens. `check.ts` holds each trophy's
  condition on the `GameState` (`EARNED`: a close call, the first night kept, a bat chased, a
  window's call kept, a chain lit at nightfall, `NIGHT_WATCH` 5 nights kept, a district other than
  the keep, the Great Festival, `CURSES` 4 curses taken, `KEEPER` 20 nights kept) and
  `checkTrophies(state)`, which `GameScene.update` calls every frame after `tick`. A new trophy is
  an entry in `index.ts`, its two texts in each language file and its condition in `EARNED`.
- `main.ts`: creates the `Phaser.Game` (960x540, `Phaser.Scale.FIT`, `pixelArt: false`) with
  `BootScene` and `GameScene`, calls `setupGame(game)` from `shared/setupGame.ts` and
  `setupScaling(game, { fill: true })` from `shared/scaling.ts`, and in dev builds puts `game` on `window`.
- `scenes/BootScene.ts`: calls `bakeTextures`, then starts `Game`.
- `scenes/GameScene.ts`: builds the world, order card, gust, owl and window plaques, HUD and
  panels (night, move, peril, game over, festival) once; `update` ticks the rules, turns `state.events`
  into popups and redraws from state. `drawDistrict` swaps the scenery texture when the keep moves
  (baking it with `bakeScenery` the first time), and `drawLanterns` moves each lantern's images,
  tag, kind label and tap zone to where the district hangs it, and hides the images and tap zone
  of a spot the night has no lantern on.
- `scenes/layout.ts`: `VIEW`, `HUD`, `DUSK_BAR`, `NIGHT_PANEL`, `SHOP` (three columns, three
  rows: the seven upgrades, the cask and the hearth), `NEXT_BUTTON`, `SMALL_PANEL` (game over and festival),
  `MOVE_PANEL` and `MOVE_CARDS` (the choice of district; the peril panel reuses the panel and
  the first row's x), `BUTTON`, `ORDER` (the order card),
  `KIND_TAG` (the night-kind plaque), `GUST_TAG` (the gust and owl plaques' size), `CALL_TAG` (the
  window plaque), `CASK_HUD`, `LANTERN_HIT`, `BAT_HIT`, `MOTH_HIT`, `UI_DEPTH` and `FONT` (Georgia / DejaVu
  Serif / serif).
- `game/places.ts`: `JAR`, `JARS` (the gate's jar and the second one), `DISTRICTS` (each district's `spots` in view pixels, in the order
  nights add them, with names, its `chains` and `rule`; the district's and spots' names and the
  rule's blurb are `TextKey`s, while a chain's `name` is a label for code readers, never shown), `DISTRICT_IDS`, `LANTERN_SPOTS` (the keep's) and `mothRest` (30 px apart on a jar's rim).
- `game/state.ts`: `GameState`, `Lantern`, `Moth`, `Bat`, `Gust`, `GameEvent`, `Order`,
  `OrderGoal`, `NightReport`, `NightKind`, the balance constants, `MOTH_KINDS`, `KIND_ORDER`,
  `FIREFLY_LANTERNS`, `QUEUE_MAX`, `GUST_WARN_MS`, `gustsFor`, `NIGHT_KINDS`, `drawKind`,
  `FOG_BURN`, `FEAST_PAY`, `STORM_GUSTS`, `BAT_SPEED`, `BAT_FLEE`, `BAT_Y`, `batsFor`,
  `CHAIN_BONUS`, `chainsFor`, `chainLit`, `chainsOf`, `districtOf`, `FESTIVAL_NIGHTS`,
  `CLOSE_CALL`, `CLOSE_CALL_PAY`, `closeCallPay`, `ORDERS`, `orderFor`, `orderProgress`,
  `UPGRADES`, `stats`, `mothSpeed`, `mothLightMs`, `LANTERN_KINDS`, `lanternKindsFor`,
  `BELL_RANGE`, `stunned`, `lanternPay`, `OWL_*`, `owlsFor`, `threatened`, `CALL_*`, `callsFor`,
  `callPay`, `CASK_*`, `usesCask`, `caskSpare`, `MOVE_EVERY`, `VESPERS_*`, `TRADE_BURN`, `TIRED_*`,
  `NECTAR_MS`, `restMs`, `HEARTH_COSTS`, `hearthCost`, `PERIL_*`, `CURSES`, `WET_WICK`,
  `THIN_BURN`, `RESTLESS_BATS`, `perilMult`, `required`, `restOf`, `newGame`, `send`, `chase`,
  `swapJar`, `tick`, `nextCost`, `buy`, `rekindle`, `topUp`, `carryOn`, `moveTo`, `takeCurse`,
  `endPeril` and `nextDusk`. No Phaser;
  `baseBurnMs` reads `byDifficulty` from `shared/settings.ts`. The catalogues name their texts by
  `TextKey` (`UPGRADES`, `CURSES` and `NIGHT_KINDS` names and blurbs, `LANTERN_KINDS` names, and each
  `Order`'s `text`), which the scene shows with `t`; the rules never read a text.
- `game/save.ts`: `loadBest`, `saveBest`, `loadBestPeril` and `saveBestPeril`.
- `art/puppet.ts`: `bakeTextures`, `bakeScenery(scene, district)` and the painters. Full-screen
  layers are painted at `BACK_RES` (1 on a screen that needs no scaling, up to 4 on a 4K screen)
  and drawn at 1 / `BACK_RES` by `GameScene.backdrop` (`screen-0/1/2`, `castle-<district>` with
  the jar, from `SCENERY` (each district's card path and trim) over the shared hills, grass and
  jar, `stars`, `fog`, `bunting`); sprites
  and plaques at `RES` (2, up to about 4.3) and drawn at scale 1 / `RES`. `bakeTextures` sets both
  from `sharpRes` before painting, so read them at run time, never copy them into a constant.
  Then: `moon`, `glow`/`glow-pale` (additive), `lantern-lit`/`-dark` (32x56) and
  `lantern-<kind>-lit`/`-dark` for the special kinds (32x60, `LANTERN_GELS`), all anchored 36 px
  down (`lampOriginY(kind)` gives the origin; `setTexture` keeps the old fraction, so the scene
  sets it again after each swap), `flame`,
  `moth-<kind>-up`/`-down` (`MOTH_LOOK`: size and gel colour), `hud`, `dusk-fill` (cropped to the
  dusk left), `dusk-rim`, `sun`, `hearth-lit`/`-out`, `coin`, `cask-full`/`-empty`, `order-card`,
  `pip-lit`/`-dark`, `gust-tag`, `owl-tag`, `call-tag`, `kind-tag`, `kind-<kind>` (the plaque's
  emblems), `save-tag`, `spark`, `bat-up`/`-down`, `owl-up`/`-down`, `sky-lantern`, `panel`,
  `panel-small`, `panel-move`, `jar` (the second jar), `card-on`/`-off`, `card-wide-on`/`-off` (the district cards),
  `btn`/`btn-hover`. The glows stay at 1x, as they are soft anyway. Plaques, cards and panels are
  baked with `PAD` pixels of room for their shadow; place them at (x - `PAD`, y - `PAD`) with origin 0. Also exports `INK`,
  `INK_HEX`, `DUSK` (layout's `DUSK_BAR`) and `SCREENS`.
- `ui/Button.ts`: `makeButton`, the carved card button (texture swap on hover, a `Zone` for taps).

Shared code it imports (outside the game folder): `shared/setupGame.ts` (`setupGame`),
`shared/scaling.ts` (`setupScaling`, `sharpRes`, `viewSize`, `viewFrame`), `shared/audio.ts` (`sounds`, `ui`, `playMusic`, `playSting`), `shared/settings.ts` (`byDifficulty`,
`settings`) and `shared/i18n.ts` (`translator`, `byLanguage`, `formatNumber`, `language`,
`Translation`).

Screens: `setupScaling` gives the canvas `renderScale` canvas pixels per game pixel (up to 4 on a
4K screen) and zooms the one camera to match from its top-left. With `fill: true` the view also
takes the screen's shape (960x540 at its smallest, up to 1296 wide on an ultrawide or 720 tall on a
4:3 tablet). The world, the rules and the panels keep their 960x540 coordinates: `GameScene.create`
scrolls the camera by (-`FX`, -`FY`), so that frame (`viewFrame`) sits in the middle of the view,
and the scene's `left`, `right`, `top` and `bottom` are the view's edges in world pixels.
`bakeTextures` reads `viewSize` and `viewFrame` and sets `FX`, `FY` (exported from
`art/puppet.ts`): the full-view layers (screens, scenery, stars, fog, bunting) are baked at the
view's size and painted over all of it (the hills, grass, ground strip, paper fibres, stars and fog
reach into the extra bands), and the `hud` bar spans the view at `HUD_RES`. The HUD's left group
(night, hearths, coins, cask) and the order card are pinned to the view's left edge, lanterns lit
and the kind plaque to its right, all under its top; the dusk bar stays in the middle. The dims
behind panels (`dim`) cover the whole view, and the gust, owl and call plaques, the gust's wind,
the owl's row line, the rain and the festival's sky lanterns use the view's edges. Bats and the owl
fade in over the band just outside the frame (`edgeFade`), so they don't pop into sight on a wide
view. At 960x540 the frame is the whole view and nothing moves. Every tap is a `Zone`, which reads
the world through the camera, so no `viewPoint` is needed; nothing reads `pointer.x/y` or
`this.scale`. Texts take `renderScale` as their resolution, so don't set one.
On a phone held upright the shared scaling turns the game to fill the screen. `e2e/screens.spec.ts` at the root opens the game
on five screens.

How it runs:

- `update(time)` computes `dt` from the frame timestamp (clamped to `MAX_STEP_MS`), calls `tick`,
  drains `state.events` into popups, and on a phase change saves the best and starts the nightfall
  popups. Then it sets every image from state (screens, scenery, lanterns, owl, moths, tags, HUD,
  panels) and redraws the Graphics layers (`marks`: oil bars and rings; `wind`; `trails`; the gust
  pointer; `cords`: the chains; `rain`; `batMarks`: bat lines, rings and the bell's stun ring;
  `owlMarks`: the owl's row line and rings, and the window call's ring).
- `tick` only runs in `'dusk'`: oil burns (faster on fog; not on a lantern a moth sits on), then
  each moth moves at its kind's speed (`out` to its lantern, `lighting` for its kind's
  `mothLightMs`, then `guard` if a gust or the owl is coming for that lantern, else a firefly's
  next hop or `home` to its rest spot, then `idle`; `chase` follows its bat). Then `wind` warns
  or blows the gust, `greatOwl` warns or flies the owl, `raiders` brings in and moves the bats
  (not one a lit bell holds), `windows` starts or runs out a call, a moth that is idle takes the
  oldest queued tap, the dusk clock runs down and `nightfall` scores (lanterns by kind and
  district, all-lit bonus and chains, doubled on a feast, then the order), draws the next kind,
  checks the festival and whether the district can move. A lantern lit on the last tick counts.
- Input: one `Zone` per lantern spot calls `send`; one `Zone` per bat (depth 7.5, above the
  lanterns' zones, moved off screen when unused) calls `chase`; the shop cards' zones call `buy`
  (the Cask card `topUp`, the Hearth card `rekindle`); the move panel's district cards call
  `moveTo`; the peril panel's two cards `takeCurse` (and save the best multiplier) and "Go on"
  `endPeril`; a moth's zone calls `swapJar`; "Next dusk" calls
  `nextDusk`, "Keep going" `carryOn`, and "New keep" `restart`.
- Panels open `PANEL_DELAY_MS` after nightfall so the popups show first; `panelOpen` says when.

State model (`GameState` in `src/game/state.ts`):

- `phase` is `'dusk'`, `'night'` (panel open, shop live), `'festival'` (the Great Festival's
  panel, once), `'move'` (a fifth nightfall's choice of district), `'peril'` (the curses offered)
  or `'over'`. `duskMs` counts
  down.
- `lanterns[i]` sits at the district's `spots[i]`: `kind`, `lit`, `oilMs` left of `oilMaxMs`,
  `claimed` while a moth is on its way to it, lighting it or guarding it.
- `moths[i]` has a `kind`, a position, a `task` (`idle`, `out`, `lighting`, `guard`, `chase`,
  `home`, `rest`), its `target` lantern, `lightingMs`, `closeCall` (set when it arrived at a nearly
  dry lantern), `bat` (the id it chases), `hops` (lanterns left on a firefly's flight),
  `reserved` (left with a cask fill reserved: a spare fill and a fill that adds oil to its lit
  lantern, settled in `dispatch`), `flights` (since it last rested) and `restMs`.
- `kind` and `nextKind` are this night's and the next night's kind. `batTimes` are the bats still
  to come, `bats` those on screen (`id`, position, `target`, `task` `fly` or `flee`), `nextBat`
  the next id and `chased` the bats chased off this dusk. `festival` is set once the Great
  Festival is reached.
- `queue` holds lantern indexes whose taps wait for a moth, oldest first, at most `QUEUE_MAX`.
  `send` queues a tap only when no moth is idle and the lantern is not claimed or already queued;
  otherwise the tap is lost.
- `order` is the night's `Order`; `orderProgress(s)` gives `{ done, of }`.
- `gusts` are the dusk-left times of the gusts still to come; `gust` is the warned one
  (`{ target, atMs }`) or null. `closeCalls` and `shields` count this dusk's.
- `events` lists `closeCall`, `gust`, `bat` (snuffed or driven off), `chased`, `owl` (snuffed or
  kept), `call` (kept or run out) and `dry` events since the scene last looked; the scene empties
  it.
- `owls` and `owl`, `callTimes`, `call` and `callsKept`, `cask`, `district`, `nextDistrict` and
  `moveDue`, `homes`, `rekindled`, `curses`, `offer`, `paidMult` and `bestPeril` are described
  under their upgrades above.
- `levels` per upgrade; `stats(s)` turns them into moth count, speed, wick time and burn time.
- `report` is the last nightfall's tally (`lit`, `count`, `required`, `earned` with the order's
  reward, `lostHearth`, `orderMet`, `chains` lit, `festival`); `kept` counts nights that met the
  quota, `best` the most.

Persistence: three `localStorage` keys: `lanternkeep-best`, the most nights kept, written when
nightfall ends a dusk (to night or game over), `lanternkeep-best-peril`, the best pay
multiplier reached with curses, written when a curse is taken, and `lanternkeep-trophies`, the
trophies earned (`shared/trophies.ts`, each id with the time). The hub's settings are read from the shared
`hub-settings` key.

Randomness and timing: the only `Math.random` in the rules are `drawKind` (never on night 1, so the
playthrough's night is fixed, and the test seeds it anyway) and `drawOffer` (only from night 10); no `Date.now` or `performance.now`.
Gust and bat targets, bat edges and orders are deterministic. Game time is the frame timestamps `update` receives. The art uses a
seeded generator in `puppet.ts`. Popups, flares and sparks are cosmetic Phaser tweens.

### Hub settings

- `src/main.ts` calls `setupGame(game)` right after creating the game (frame cap, FPS readout, reduced motion and full screen).
- Difficulty scales one number: the burn time, `baseBurnMs()` = `byDifficulty(26_000, 20_000,
  16_000)`. Keep Normal at 20 s: the playthrough expects it. The moth kinds, the queue, the gusts,
  the close-call share, the orders, the kinds of night, bats, chains and the festival are not
  scaled by difficulty.
- `settings.reduceMotion` holds still: the moths' wing flaps (wings stay up) and bobbing, the
  lantern glow's and flame's flicker, the pulse of the close-call rings, the spin of the gust's
  dashed ring and the travelling gust along its wind curls, the rise of popups (they only fade)
  and the spread of the close-call sparks, the drift of the fog, the falling rain (drawn still),
  the bats' flapping and bobbing (a resting moth's wings stay folded either way), the owl's flapping and bobbing and the travelling dashes of its
  row line, the pulse of a window call's ring and the rising sky lanterns. The game uses no camera
  shake or flash.
- Keep the Lanternkeep row of the difficulty table in the root README and the line in this game's
  README in step with the `byDifficulty` values.

### Sound

All in code through `shared/audio.ts`; the rules (`game/state.ts`) stay free of sound. The scene
takes a `snapshot` of the state before `tick`, then `frameSounds` plays the frame's events and
what changed (only during dusk); the tap handlers play their action's sound when the rule
function returns true and `ui('refuse')` when it returns false (`tapLantern`, `answer`).

Music, `SONG`: music-box folk in A minor at 108 BPM in eighth notes (triangle lead, thin pulse
pizzicato arpeggio, triangle bass, soft shaker). `updateMusic` (every frame, switching only when
the part changes, at the next bar) picks:

| Part | When |
| --- | --- |
| `dusk` | a clear dusk |
| `fog`, `feast`, `storm` | a dusk of that kind (sparse and muted, a bouncy dance, driving with rain on the hats) |
| `late` | the last 10 s of any dusk (`LATE_MS`): pulsing bass and a ticking clock |
| `lullaby` | every phase but dusk: night panel, festival, district choice, curses, game over |
| `festival` (sting) | the nightfall that reaches the Great Festival |
| `over` (sting) | the nightfall that puts the last hearth out |

`create` and `restart` call `updateMusic(state, true)`.

Sound table, `sfx` (plus the shared `ui('coin')`, `ui('refuse')` and `ui('click')`):

| Sound | Where |
| --- | --- |
| `flutter` / `pip` | `tapLantern`: a moth sent / the tap queued (lost or ignored taps buzz) |
| `strike` + `fwoomp` | `frameSounds`: a moth finished lighting or refilling a lantern (one per frame) |
| `sparkle` + coin | `closeCall` event |
| `clunk` | `dry` event |
| `fizzle` | any lanterns going dark in a frame: burnt out, blown out, snuffed by a bat or the owl (merged into one) |
| `windSwell` / `gust` / `ting` | gust warned / `gust` event / a shielded gust or owl |
| `squeak` / `bounce` / `whoosh` | a bat comes on screen / a bat driven off a guarded lantern / `chased` (and a tapped chase) |
| `hoot` / `sweep` | the owl warned / the owl starts its sweep |
| `chime` / `callKept` + coin / `callLost` | a window calls / `call` kept / `call` ran out |
| `yawn` / `swap` | a moth goes to rest / `swapJar` |
| `toll`, coins, `thud` + `minor` | `nightfallSounds`: the bell, a rising coin per lit lantern, a lost hearth |
| `kaching` / `glug` / `swell` | the shop: `buy` / `topUp` / `rekindle` |
| `evening` / `rumble` / `pluck` | `nextDusk` / `moveTo` / `takeCurse` |
| click | "Go on", "Keep going", "New keep" |

The nightfall coins and stings are timed with `this.time.delayedCall`, so they pause with the
scene. Under browser automation nothing plays, so the playthrough is unchanged.

## Testing hooks

- `window.game` in dev builds. The test reads `game.scene.getScene('Game')` and its `state`
  (copied through JSON) and `panelOpen`. `shopButtons`, `nextButton` and `carryOnButton` give the
  panel buttons in frame (world) coordinates, which match view pixels only at 960x540, for tests that go past the first night; `perilButtons` (the two
  curse cards, in `state.offer` order when the panel opens) and `goOnButton` the peril panel's.
- Inputs: it clicks lanterns at their `x`, `y` from state, scaled by the canvas bounding box.
- The test mirrors these, so change them together: `DUSK_MS` (45 s), the first night's five
  lanterns and quota of three, three moths in kind order (fast, slow, heavy), three lives, the 20 s
  burn, the pay (5 a lantern, 10 bonus), night 1's order (lanterns 0, 1, 2 for 15), night 1's one
  gust at 34 s left warned 5 s before, the close call (under 15%, 2 coins), the scene key `'Game'`
  and the fields above (`queue`, `order`, `gusts`, `gust`, `closeCalls`, `shields`, `kind`
  `'clear'`, empty `batTimes`, and the report's `chains` 0 and `festival` false too). It checks
  `report` with `toEqual`, so a new report field changes the test. Night 1 has no window call,
  no cask use (refills are free before `CASK_NIGHT`), plain lanterns, no owl and the keep, so
  none of the round-2 systems touch it, nor do tired moths (night 6), the jar, the hearth or the
  curses (no offer before night 10, `perilMult` 1). `moveButtons` gives the district cards for tests that
  play five nights.
- The timing matters. It lights lantern 0 at the start (lit about 41 s left); when the gust is
  warned (39 s left) it taps lantern 0 again, and the fast moth refills it and guards it until the
  gust passes (34 s left); the lantern burns no oil meanwhile, so it runs low (under 15%) at about
  17 s left. Then it taps lanterns 0, 1 and 2 (one moth each; lantern 0's refill is the close
  call) and 3 and 4, which queue and are taken as moths come home. The last lantern is lit about
  10 s after the wave, before nightfall. Slower moths, longer wicks, far lantern spots or moved
  gusts can break that; re-check the margins after changing `BASE_SPEED`, `BASE_LIGHT_MS`,
  `MOTH_KINDS`, `LANTERN_SPOTS`, `JAR`, `mothRest`, `gustsFor`, `GUST_WARN_MS` or `CLOSE_CALL`.
- After the night panel opens it checks that `lanternkeep-trophies` holds `closeCall` and
  `firstNight` (Just in time and First light) and nothing else; a trophy night 1 can reach in
  another way changes that expectation.
- It saves `playthrough-0-dusk`, `-1-first-lantern`, `-2-gust-shield`, `-3-all-lit` and
  `-4-night` screenshots; copy them into `docs/screenshots/` when the look changes.
- `docs/screenshots/fill-ultrawide.webp` and `fill-tablet.webp` show the first dusk filling a
  2560x1080 and a 1024x768 screen.
- `cover.png` and `docs/screenshots/loop-herald-order.webp`, `loop-gust-shield.webp` and
  `loop-close-call.webp` were staged with a scratch Playwright script against the dev server: it
  sets `state` fields through `window.game` (night 4 at 17 s left, eight lanterns, four moths, a
  warned gust, a queued tap; for the order shot night 3 with the close-call order at 1/2) and
  pushes a `closeCall` event onto `state.events`. Refresh them the same way.
- `loop-foggy-night`, `loop-feast-chains`, `loop-stormy-night`, `loop-bat-chase`, `loop-firefly`,
  `loop-great-festival` and `loop-night-panel` were staged the same way: end night 1 by setting
  `duskMs`, set `night` and `nextKind` and click "Next dusk" (the Firefly card for the firefly
  shot), light lanterns through state, push a bat time onto `batTimes` and click the bat, or set
  `kept` to 9 before nightfall for the festival.
- `loop-window-call`, `loop-oil-cask`, `loop-lantern-kinds`, `loop-great-owl-warned`,
  `loop-great-owl`, `loop-district-choice`, `loop-docks`, `loop-chapel` and `loop-market` were
  staged the same way: set `night`, `nextDistrict` and `district` before ending a dusk and click
  "Next dusk", light lanterns through state, set `duskMs` just before a call, the owl's warning
  or its sweep, set `cask` to 0 and push a `dry` event, and end night 5 for the move panel.
- `loop-night-panel`, `loop-tired-moths` and `loop-peril` were staged the same way: coins and
  `lives` set and night 4 ended to click the Jar, Hearth and Nectar cards, `night` set to 6 and
  every moth's `flights` to 3 before tapping three lanterns, then `night` 10 with `festival` set
  ended to pick a district and take the first curse.

## Making common changes

- **Add or change a text**: its key in `i18n/en.ts` and the German in `i18n/de.ts` (the build
  fails without it), shown with `t`; a catalogue row names its key, not the English. Run
  `node scripts/check-translations.mjs`. German runs longer than English, so check it fits: the
  shop cards (name, level and cost share one line, the blurb about 28 characters), the order card,
  the plaques' notes and the "Next dusk" button. Run the playthrough with a `de-DE` locale too
  (or open the game with `?lang=de`).
- **Retune a night**: the constants at the top of `src/game/state.ts`, `lanternsFor` and
  `requiredFor`; update the README and the test's constants.
- **Add or change an order**: a row in `ORDERS` with its text's key (its `lit` lanterns must exist on every night it
  comes round on: night n has `lanternsFor(n)` lanterns). `GameScene.drawOrder` shows up to three
  pips; a goal with more needs more `orderPips`. Night 1's order is mirrored in the test.
- **Retune gusts**: `gustsFor` and `GUST_WARN_MS` in `state.ts`; night 1's gust is in the test.
- **Add an upgrade**: add its id to `UPGRADE_IDS`, its row to `UPGRADES` and `levels`, apply it in
  `stats` (or where it acts), and give `SHOP` a fourth row (the three rows of three are full).
- **Add a curse**: a row in `CURSES` (its name and blurb keys in both `i18n` files), its count in `newGame`'s `curses`, and its effect where the
  rule lives (`mothLightMs`, `batsFor`, `tick`, `required`); the panel shows it on its own.
- **Add a kind of lantern**: a row in `LANTERN_KINDS` (its `oil`, `wick` and `pay`), its id in
  `SPECIAL_KINDS`, its gels in `LANTERN_GELS` and any emblem in `paintLantern`, and its textures in
  the `bakeTextures` loop; a rule beyond those multipliers goes in `tick` or `raiders` like the
  bell's.
- **Add a district**: an entry in `DISTRICTS` (ten spots with name keys, four chains, a rule) and its
  scenery in `SCENERY` in `puppet.ts` (a card path around the spots, with `merlonXs` to skip them,
  and the trim); a new rule gets a branch where the others are applied (`wind`, `lanternPay`,
  `requiredFor`, `closeCallPay`, `callPay`, `tick`). `MOVE_CARDS` has room for four cards.
- **Retune the owl, the calls or the cask**: `OWL_*`, `owlsFor`, `CALL_*`, `callsFor` and
  `CASK_*` in `state.ts`.
- **Add a kind of night**: a row in `NIGHT_KINDS`, its effect in `tick`, `nightfall` or
  `gustsFor`, its emblem in `paintKindIcon` and the list in `bakeTextures`, and any layer in
  `GameScene.drawKind`.
- **Add or change a chain**: a row in the district's `chains` in `places.ts` (lanterns side by side, in the order the cord
  runs; `payout` puts its popup between the first and last).
- **Retune bats**: `batsFor`, `BAT_SPEED`, `BAT_FLEE` and `BAT_Y` in `state.ts`.
- **Move or add a lantern spot**: edit `LANTERN_SPOTS`; the castle's merlons skip spots on their
  own, but check the castle art still reads around it and the test's timing margins.
- **Add a moth kind**: add it to `MOTH_KINDS` and `KIND_ORDER` in `state.ts` (its speed, wick and
  oil multipliers), and give it a size and gel colour in `MOTH_LOOK` in `art/puppet.ts` (its
  textures are baked from that list). A bought kind like the firefly stays out of `KIND_ORDER`
  and is added by `makeMoths`.
- **Change the queue**: `QUEUE_MAX` in `state.ts`; the test asserts the queue contents.
- **Restyle**: shapes and colours live in `art/puppet.ts`; the texture anchors there must match
  the scene's placements (`lampOriginY` for the lanterns, `PAD` for plaques).

## Gotchas

- `send` on a lit lantern refills it, by design; there is no "already lit" refusal.
- A lost tap and an ignored one both return false from `send`: a tap on a lantern already claimed
  (including one a moth guards) is ignored, a tap with no moth idle and a full queue is lost.
- A queued tap is dispatched in `tick` after the moths move and the wind, so the moth that just
  came home (or was released by a passing gust) takes it on the same frame; the queue never holds
  a lantern a moth has already claimed.
- The gust picks its target when it is warned, not when it hits; if that lantern burns out or is
  snuffed before then, the gust does nothing (no event, no popup). A moth still flying to it
  (`out`) does not shield it.
- Night 1's quota is `ceil(5 * 0.6)` = 3; `requiredFor` rounds up.
- Night 1 must stay clear with no bats and no chain (every chain has a lantern from night 2 on),
  no window call, free refills and plain lanterns: the playthrough's pay and refills depend on it.
- `s.district` is set from `nextDistrict` in `nextDusk`, so a move chosen on the panel shows
  from the next dusk; the orders are named for the district the night is played in.
- The owl warns once per night at most and its row is picked at the warning, so lanterns lit on
  it later are still at risk; a dark lantern it passes makes no popup.
- The lantern images, kind labels and tap zones are moved to the lantern's position every frame,
  so a district's spots are never copied anywhere in the scene.
- A bat zone's `pointerdown` reads `state.bats[k]` when tapped, as bats are removed from the
  array when they leave the screen.
- `report.festival` is true only on the one nightfall that reaches the festival; `state.festival`
  stays true after, so the panel says the festival was held and later nights never reach it again.
- A new full-view texture goes through `backdrop` (or `setScale(1 / BACK_RES)`), a new sprite
  through `sprite` (or `setScale(1 / RES)`), or it shows at the wrong size on a big screen. Bake a
  full-view texture at the view's size (`VW` x `VH`, offset by `FX`, `FY`) and paint it over
  -`FX` to 960 + `FX` and -`FY` to 540 + `FY`, or it leaves an empty band on a screen of another
  shape. Pin new HUD items to `left`/`right`/`top`, not to 0 or `VIEW.w`.
- The test forces Phaser's canvas renderer; additive glows (`BlendModes.ADD`) and `setCrop` work
  there, tints do not, so the art swaps textures instead of tinting.
