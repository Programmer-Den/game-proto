# Golem Garden: guide for agents

How Golem Garden is built and where things stand, for agents changing it. README.md covers how to
play and the golem and pest numbers. Keep this file up to date with any change to the game, per the
root AGENTS.md.

## Current state

Golem Garden is a real-time tower defense on a 12x7 garden, one of three layouts (`GARDENS`).
Pests walk dirt paths from the left edge to the Heartwood at their end. The player plants seeds on
soil cells beside the path; each grows into a golem that throws at pests within reach, and a hedge
seed blocks a path cell. Squashed pests drop sap, which buys seeds and golem levels. Waves are
started by the player, without end; the next one can be called early. Wave 30 is the garden's
harvest, which earns the stars that unlock the other gardens; past it the garden grows wild. Laurels
from thorny harvests buy golem grafts, and a daily plot gives every player the same seeded garden
once a day. Clearing wave 10 and 20 unlocks the Fungus and Bell golems, a weekly garden with a
twist is the same for everyone all week, and the garden editor draws plots of your own. The art is claymation (plasticine on
a studio table), painted in code at startup.

Implemented today:

- One screen (`GameScene`): the garden, a clay HUD strip (title, the garden tag that opens the
  garden picker, wave, Heartwood leaves, sap, the Heartwood bloom tag with five flowers, best, the
  1x/2x speed button; the wave tag's second line says "harvest at 30" or the stars harvested, and
  the best tag counts total stars), a side panel with six seed cards (five compact golem cards,
  Thorn, Fungus and Bell shown as padlock cards until they unlock; then the Hedge strip), the next wave's preview,
  a hint line and the wave button, a hover outline with a bead ring for reach and a ghost golem (or
  ghost hedge on the path), the golem menu, a banner for cleared or called waves, compost, the
  harvest, buds and the Queen Slug, and the garden picker overlay (also the game-over and the
  harvest screen), the plots overlay and the garden editor. While an overlay is open, `update`
  ticks the state by 0, so the game stands still behind it.
- Five golems, pebble, moss (slows), thorn (pricks every pest in reach at once), fungus (spores)
  and bell (stuns), each with three levels.
- Fungus and Bell golems (GG17): `GolemInfo.unlockBest` (10 and 20) keeps them locked until
  `state.best` reaches it (`unlocked`; open in the daily plot and weekly garden), shown as padlock
  cards ("Clear wave N to unlock"); `waveDone` adds a "… unlocked!" line the first time. A fungus
  golem's `GolemStats.spore` (`r`, `ms`, `dps`, from `GolemInfo.spore`, its `dps` growing 60% a
  level like damage) makes each throw push a `Spores` patch onto `state.spores` at the target; in
  `step` each walking pest (not flying, not under ground) inside a patch loses the strongest
  covering patch's `dps` (no stacking). A bell golem (`area`, `GolemStats.stun`, 20% longer a
  level) sets `Pest.stunMs` on every pest in reach, `BOSS_STUN` (half) for the queen, unless its
  `stunGuardMs` still runs (the stun plus `STUN_GUARD_MS`, 1.5s); a stunned pest neither walks nor
  chews. Its throw is one `Shot` with `ring` (its reach) and `RING_MS`, drawn as a spreading ring;
  stunned pests wear three pale blue beads. Forms: Puffball and Blight (`FormInfo.spore`
  multipliers), Chime (cooldown) and Gong (`FormInfo.stun`, damage, reach). Neither makes a combo
  (`comboAt` only for pebble and thorn).
- Weekly garden (GG19): `weeklyGarden(weekOf(today()), GARDENS.length)` (a `Week`: the week
  number, from Monday, and its garden and twist; `WEEK_TWISTS` turn every week, the garden every
  third), planted from the plots overlay with `StartData.weekly` into `newGame`'s `extras.weekly`
  (`state.weekly`). `twistOf` returns its twist, so 'hedges' fades the hedge strip as in the thorny
  Meadow; 'seeds' (`barred`, `TWIST_SEEDS`) fades every golem but Moss and Thorn; 'double'
  (`waveFor`) adds a twin 350ms behind every spawn but the queen. Every golem is open; grafts
  count.
- Drawn plots (GG18): `PLOT.slots` (3) plots saved as `Drawing`s (`path` cells in order from
  column 0, `soil` cells). The plots overlay (`showPlots`, from the picker's Plots button,
  `plotsButton`) shows the weekly card and a card per slot; the editor (`showEditor`) draws on a
  grid at `EDITOR` with the Path and Soil tools (`editDrawing` in `board.ts`) and Clear, and saves
  with Plant it or Back (a changed drawing resets its best). `drawingOk` checks a drawing;
  `drawnGarden` builds its `Garden` (one route, corners where the path turns, the Heartwood on its
  last cell, `'grass'` cells off the path and beds, where nothing is planted), which
  `StartData.plot` plants as `state.plot` (`{ slot, garden }`; `gardenOf` returns it) on the
  `bg-plot` texture (`bakePlot`). Weekly gardens and plots are not `ordinary`: no stars, laurels,
  wild record or harvest picker, and wave 30 can be called early; their own best wave (`ownBest`,
  `saveOwnBest`, `savedOwn`) shows on the wave tag and the cards. A plot drawn again while it is
  being played stops saving its best (`playedDrawing`).
- Golem menu (GG1): tapping a golem opens Raise (`upgrade`), Aim (`setTarget`, `nextTarget`),
  Move (`move`, `MOVE_FEE` = 10 sap, then a tap on free soil) and Uproot (`uproot`, gives back
  `UPROOT_REFUND` = 70% of `Golem.spent`). The speed button sets `state.fast`; the scene plays
  `FAST` (2) times the frame's time.
- Level 3 forms (GG6): the raise from level 2 to 3 (`picksForm`) turns the menu into the golem's
  two forms (`formsOf`, from `FORM_INFO`: Boulder or Sling, Bog or Spore, Bramble or Barb) and
  Back (the scene's `formMenu`); `upgrade(s, g, form)` then sets `Golem.form` for good.
  `golemStats(kind, level, form)` (and `statsOf(g)`) folds the form in: a damage multiplier, added
  reach, a cooldown multiplier, its own `slow`, `area` (Spore), `splash` (Boulder: half damage on
  every other pest within 44px of the target, in the golem's reach or not) and `pierce` (Barb
  ignores armour). A slow lands only if it is at least as strong as the pest's current one
  (`slowFactor`); an equal one tops up `slowMs`. A level-3 golem
  wears a bead in `FormInfo.colour` on its shoulder.
- Targeting (GG7): `Golem.target` is one of `TARGETS` (`first`, the default, `strongest`,
  `weakest`, `flyers`); `pickTarget` picks among the pests in reach (flyers: `PestInfo.flies`,
  the crow, then first). Area golems ignore it and their Aim chip is off.
- Hedges (GG8): the fourth seed card selects `'hedge'` (`SeedKind` is `GolemKind | 'hedge'`;
  `state.selected` is a `SeedKind`). `plant` on a free path cell (`freePath`, never the
  Heartwood's) pushes a `Hedge` (`HEDGE.cost` = 15 sap, `HEDGE.hp` = 60) with `stops`: for each
  route, the distance `HEDGE_STOP` (30px) before the cell's centre (`routeDist`), or null. In
  `step`, a walking pest that would pass a stop halts there and takes
  `bite * CHEW_PER_BITE` (6) health a second off the hedge; crows (`flies`) and a mole in its
  tunnel pass. Hedges at 0 health are dropped. The scene draws them (`drawHedges`) with a bar.
- Compost (GG9): `finishWave` from `COMPOST.fromWave` (3) adds `COMPOST.rate` (10%) of the sap
  unspent, floored and at most `compostCap(s)` (`COMPOST.cap`, 30, plus `BOON.compostCap` per
  Rich compost boon), and records it in `state.compost` for the banner; the hint and the boon
  card show the same cap.
- Harvest (GG10): `finishWave` at `HARVEST_WAVE` (30) sets `state.harvest` to
  `harvestStars(heart)` (1, 2 or 3 stars at `STAR_LEAVES` 1, 6 and 10 leaves) and raises
  `state.stars[garden]`; the scene opens the picker in 'harvest' mode (Keep going) and saves the
  stars. Gardens unlock by total stars (`Garden.unlockStars`, `gardenOpen`, `totalStars`): Forked
  Brook at 1, Two Gates at 3. The waves go on after the harvest.
- Combos (GG2, `comboAt`): a grown moss golem one cell up, down, left or right of a pebble golem
  makes its hits on slowed pests do `COMBO.slowedDamage` (1.5x); of a thorn golem, makes it prick
  `COMBO.thornPricks` (2) times per throw. The scene draws a clay vine with a gold (pebble) or pink
  (thorn) bead between the pair.
- Seven pests in waves from `waveFor`: beetle, slug, crow, mole (from wave 4; `tunnel`: under
  ground between 30% and 60% of its route, untargetable, drawn as the `mound`), armoured snail
  (from 5; `armour` 4 off every hit, down to 1), aphid (from 6, in swarms) and the Queen Slug
  (`boss`, every `BOSS_EVERY` = 10th wave; `slime`: the 3x3 cells round her cell are slimed for
  `SLIME.ms`, and golems on slimed cells cool down at `SLIME.slow` speed).
- Gardens (GG5): Meadow (the first, the playthrough's), Forked Brook (1 star; two routes that
  split and rejoin) and Two Gates (3 stars; two entrances). Pests take a garden's routes in turn
  (`state.spawned`). The garden tag, the harvest and the game-over screen show the picker (built
  afresh each time, with each garden's stars); a card plants that garden afresh (`saveGarden`,
  then `scene.restart`).
- Heartwood bloom: each wave cleared (or called early, once its last pests are gone) opens a bud (`state.bloom`, up to
  `BLOOM_GOAL` = 5), drawn on the tree and on the HUD tag; at 5 the Thorn golem unlocks. The bloom
  is saved and kept between gardens, so once full the Thorn golem stays unlocked.
- Calling early: once a wave's queue is empty, the wave button reads "Call wave N now, +15 early";
  `startWave` then pushes the current wave onto `state.called` (with `queenSquashed`), moves to the
  next wave and starts it. Each pest carries the `wave` it came with; once no pest of the oldest
  called wave is left (squashed or through), `step` finishes it (`finishWave(s, n, queenSquashed)`:
  bonus, compost, bud, best, boons) plus `EARLY_BONUS` and pushes it onto `state.settled`, which the
  scene drains into the "Wave N cleared" banner. The call's own banner says the sap waits
  (`calledPending`). Not on `HARVEST_WAVE`: `canCallEarly` is false there, so the harvest
  counts the leaves left once wave 30 is cleared, and the button reads "Harvest wave". Nor while
  a Queen Slug is on the path (`queenOnPath`): the button reads "squash the queen" until she is
  squashed or gets through.
  The preview above it counts the next wave's pests with `waveCounts`.
- Boons (GG11): `finishWave` after a Queen Slug wave (`wave % BOSS_EVERY === 0`) whose queen
  was squashed (`state.queenSquashed`, set in `step`'s kill loop, cleared as a wave begins) sets
  `state.offer` to `boonOffer(wave / BOSS_EVERY, twistOf(s))`, three of `BOONS` (the first three
  (Long moss, Sunny row, New growth), then the last three (Thick hedges, Sharp rocks, Rich
  compost), in turn; under the 'hedges' twist (the thorny Meadow, a weekly garden), where no hedge
  can be planted, Long moss stands in for Thick hedges, and under the weekly 'seeds' twist, where no
  pebble golem can be planted, Sunny row stands in for Sharp rocks). The scene holds the game still (ticks by 0) while `offer` is set and shows
  `showBoons` (once no overlay is up, `overlayOpen`: after the harvest picker, and any plots, editor
  or grafts screen opened from it, closes, when both come at wave 30); a card calls
  `takeBoon`, which pushes it onto `state.boons` (a boon taken twice counts twice, `boonCount`).
  Long moss, Sharp rocks and Sunny row fold into `boonedStats`/`statsOf(s, g)`; Sunny row records
  `sunRow(s)` (the row with most grown golems, or with none grown the row with most golems
  planted, or else row 0) in `state.sunRows`, drawn as a warm stripe
  (`drawSun`); New growth adds `BOON.leaves`; Thick hedges raises the hp of hedges planted later;
  Rich compost raises the compost cap. Numbers in `BOON`, names and blurbs in `BOON_INFO`.
- Regrow a leaf (GG12): between waves (`canRegrow`: build phase, no boon pending, a leaf lost, the
  sap), a tap on the Heartwood's cell or on the HUD leaf tag calls `regrow`, which costs
  `regrowPrice(s)` (`regrowCost(regrown)`, `REGROW.base` 25 plus `REGROW.step` 25 per leaf already
  regrown in this garden). The leaf tag shows a green plus when it can, and the hint names the
  price during build with a leaf lost.
- Thorny variants (GG13): a garden with `THORNY_STARS` (3) stars (`thornyOpen`) gets a Thorny tag
  under its picker card that plants it with `state.thorny` set (`saveThorny`). `twistOf(s)` is then
  `GARDEN_TWISTS[garden]` (`TWIST_INFO`): Meadow 'hedges' (`unlocked(s, 'hedge')` is false; the
  hedge strip shows faded), Forked Brook 'crows' (`waveFor(n, twist)` adds a twin for every crow,
  700ms behind) and Two Gates 'sap' (`newGame` starts with `LEAN_SAP` = 30). Its harvest sets
  `state.laurels[garden]`, saved and shown on the tag ("laurel won"); the HUD garden tag reads
  "<name> · thorny" and the wave tag "laurel at 30".
- Wild garden (GG14): past `HARVEST_WAVE`, `waveFor` multiplies each wave's `hpScale` by
  `WILD.grow` (1.06) per wave past it (`wildness(n)`), `isBossWave(n)` brings a Queen Slug every
  `WILD.bossEvery` (5) waves as well as every `BOSS_EVERY`, and the scene draws a wild wave's pests
  `wildScale(wave)` bigger (1.5% a wave, up to 30%). Use `isBossWave` for every "is this a queen
  wave" test (music, banners, hint, boons; `bossNumber(n)` counts them for `boonOffer`).
  `finishWave` past the harvest raises `state.wild[garden]` (outside the daily plot), shown on the
  wave tag ("wild · best N") and under the garden's picker card; the wave-31 start (or call) banner
  says the garden grows wild.
- Golem grafts (GG15): `GRAFTS` (`GRAFT_INFO`), bought for good with laurels, one each
  (`laurelsFree(laurels, grafts)`, `canGraft`), in the grafts overlay (`showGrafts`, opened by the
  picker's Grafts button once a laurel is won, Back reopens the picker in its mode; `buyGraft`).
  Three are third forms (`FormInfo.graft`, same ids: Quartz, Lichen, Nettle): `formsOf(kind)` lists
  all three of a kind's forms, `formsFor(s, kind)` only those open here, and the form menu shows
  them before Back (one to three chips). The Seedling sets `state.freeSeed` in `newGame` (or when
  bought before a garden's first golem): `seedCost(s, kind)` is then 0 for a golem seed, the golem
  cards read "free" and the hint says so; `plant` clears it. `state.grafts` holds the rules' grafts
  (none in the daily plot); the overlay reads the saved list.
- Daily plot (GG16, `shared/daily.ts`): the picker's Daily plot button (`dailyButton`, refused once
  today's try is used) calls `startDaily` and restarts the scene with `{ daily: true }` (every
  restart passes its `StartData`, since Phaser keeps the last one); `create` draws
  `dailyPlot(dailyRand('golem-garden'), GARDENS.length)` (a garden, thorny or not, and one of the
  two first forms per golem) into `newGame`'s `extras.daily`, which plants it whatever the stars
  (`state.daily`). There `unlocked` opens the Thorn golem, `formsFor` offers only the day's form,
  grafts don't count, the seed cards name the forms ("lv 3: Sling") and `announceDaily` shows the
  rules. `lastWave(s)` is `DAILY.waves` (15): it can't be called early and `step` sets phase
  'over' once `state.cleared` reaches it; the scene then calls `finishDaily` with `dailyScore(s)`
  (`DAILY.perWave` a wave cleared, `DAILY.perLeaf` a leaf kept) and opens the picker in 'daily'
  mode. Planting a garden from the picker mid-plot (`leaveDaily`) scores it as it stands.
- Sap pops: each squashed pest pushes a `Pop` onto `state.pops`; the scene drains them into a
  splat, a "+N" label and three droplets that arc to the sap counter, whose glow pulses as they
  land.
- Trophies: ten (see `src/trophies/` below), awarded by `checkTrophies` from the state every frame
  and Bold call by the scene as a called wave ends clean (`Settled.clean`).
- The most waves ever cleared, the bloom, each garden's stars, laurels and best wild wave, the
  grafts, the daily record, the week's best, the drawn plots, the trophies, and the garden last
  picked (and whether thorny) persist. Boons and regrown leaves last one garden; a daily plot,
  weekly garden or drawn plot isn't resumed after a reload (the last ordinary garden is planted).

Missing or rough:

- The preview fits six kinds; the Queen Slug is named in its title instead of an icon.
- The golem menu can cover a neighbouring golem; it opens below golems in the top two rows.
- On a touch screen the form chips have no hover, so the hint names the two forms but not what
  each does until it is picked (the README's table has them).
- Pests stacked at a hedge all chew it at once, so a crowd gets through quickly.
- Boulder and sling shots look like any pebble golem's; only the shoulder bead tells forms apart.
- Pests come in at the board's left edge from under a strip of table (`edge`), so they pop in at
  the first path cell's left half.
- Pests on the same stretch can overlap; nothing spreads them out, and a bell's stun bunches them up.
- The trophies stop at ten (the most a game has), so the Fungus and Bell golems, the weekly garden and
  drawn plots earn none of their own.
- The garden editor's grid has no hover; a refused tap only buzzes.
- The hit flash is a fill tint, which the canvas renderer (used by the playthrough) does not draw.
- Canvas `filter: blur` (the clay's soft shadows) is ignored by Safari, so shadows are hard there.
- The longest hints (a level-3 golem's form, a target's blurb) wrap to three lines and run into
  the top of the wave button, in English as in German.
- The cover and the loop screenshots (`heartwood-bloom`, `call-early`, `sap-pops`, `golem-menu`,
  `golem-move`, `new-pests`, `queen-slug`, `garden-picker`, `forked-brook`, `two-gates`,
  `level-3-forms`, `targeting`, `hedge`, `compost`, `harvest`, `harvest-wave`, `boons`,
  `regrow-leaf`, `thorny-picker`, `thorny-meadow`, `trophies`, `wild-garden`,
  `daily-grafts-picker`, `grafts`, `daily-plot`, `new-golems`, `garden-editor`, `plots`) were
  staged through `window.game` with a scratch Playwright script against the dev server (set
  `state` fields and `localStorage` keys, push pests or pops, click cells and buttons, pause the
  scene); refresh them the same way.

## Architecture

File map (`src/`):

- `audio.ts`: the sound (see Sound below): `sfx`, the effects table (`sounds` from
  `shared/audio.ts`), and the songs `CALM`, `WAVES` and `STINGS`.
- `howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in English and
  German, picked with `byLanguage` and handed to `setupGame(game, { howToPlay })` in `main.ts`;
  update both when the controls or the first round change.
- `i18n.ts`: `t(key, vars)`, the game's translator (`translator` from `shared/i18n.ts`), and
  `TextKey`, a key of its texts.
- `i18n/en.ts`: every on-screen text in British English, the source; `i18n/de.ts` (German, typed
  `Translation<typeof en>`, with `keepEnglish` for the title) and `i18n/en-US.ts` (only "armor").
- `main.ts`: creates the `Phaser.Game` (960x560, `VIEW`, `Phaser.Scale.FIT`, `pixelArt: false`) with
  `BootScene` and `GameScene`, calls `setupGame(game)` from `shared/setupGame.ts` and
  `setupScaling(game, { fill: true })` from `shared/scaling.ts`, and in dev builds puts `game` on `window`.
- `scenes/BootScene.ts`: calls `bakeTextures`, then starts `Game`.
- `scenes/GameScene.ts`: builds the garden, HUD, panel, golem menu and banner, and the garden
  picker each time it opens (`createPicker(mode)` with its `PickerMode`, `showPicker`, `closePicker`, `dailyButton`, `plotsButton`), the
  grafts overlay (`showGrafts`, `buyGraft`), the plots overlay and garden editor (`showPlots`,
  `showEditor`, `plantPlot`, `plotBox`) and the boon pick (`showBoons`); `create(data)` takes
  `StartData` (`daily`, `weekly`, `plot`, all passed on every restart); turns taps into
  `select`, `plant`, `regrow`, `takeBoon`, `upgrade` (with a form, through `menuTap` and `formMenu`), `setTarget`,
  `move`, `uproot`, `startWave` and the speed toggle; calls `tick` in `update` and draws slime,
  spore patches (`drawSpores`), hedges, golems (and combo vines, form beads), pests (and mole mounds), shots, bars, level beads
  and the hover from the state; turns `state.pops` into splats, "+N" labels and flying droplets
  (`sapPop`); shows the banner (`waveDone`, `announce`); saves best, bloom and stars in `refresh`
  when they change. `frame` is the designed frame in the view (see Screens), and `dim()` the
  overlays' dark cover over the whole view.
- `scenes/layout.ts`: `VIEW`, `HUD` (title, garden tag and tag positions), `SPEED_BUTTON`,
  `GOLEM_MENU` (four chips wide), `GARDEN_CARD`, `GRAFT_CARD` (also the plots' cards), `PANEL`, `SEED_BUTTONS` (`ys` and `hs` per
  card, in `SEEDS` order), `EDITOR` (the garden editor's grid and tool tags), `PREVIEW`, `HINT`, `WAVE_BUTTON`, `BUTTON`, `UI_DEPTH`, `FONT` (a system sans stack), and
  re-exports `GRID` and `cellCentre` from `game/board.ts`.
- `game/board.ts`: `GRID`, the `Cell` (with `'grass'`, only in drawn plots), `Route`, `Garden` and `Drawing` types,
  `drawingOk`, `drawnGarden` and `editDrawing` (GG18), `GARDENS` (each with its
  name and blurb as `TextKey`s, `unlockStars`, `routes`, `map` and `heart`, built from corner lists), `cellCentre`,
  `cellAt`, `routeDist(route, col, row)` (how far along a route a cell's centre is, or null) and
  `pathPoint(route, dist)` (position and facing at a distance along a route).
- `game/data.ts`: `GOLEMS`, `SEEDS`/`SeedKind`, `GOLEM_INFO` (with `area` and `locked` for the
  thorn golem, `unlockBest`, `spore` and `stun` for the fungus and bell golems), `BOSS_STUN`, `STUN_GUARD_MS`, `BLOOM_GOAL`, `EARLY_BONUS`, `UPROOT_REFUND`, `MOVE_FEE`, `FAST`, `COMBO`,
  `MAX_LEVEL`, `UPGRADE_COST`, `FORMS`, `FORM_INFO`, `formsOf`, `GRAFTS`/`Graft`, `GRAFT_INFO`, `TARGETS`, `TARGET_INFO`,
  `golemStats(kind, level, form)` (a `GolemStats`), `HEDGE`, `CHEW_PER_BITE`, `COMPOST`,
  `HARVEST_WAVE`, `STAR_LEAVES`, `harvestStars`, `PESTS`, `PEST_INFO` (with `armour`, `tunnel`,
  `slime`, `boss`, `flies`), `BOSS_EVERY`, `WILD`, `wildness`, `wildScale`, `isBossWave`, `bossNumber`, `SLIME`, `PEST_HP_SCALE` (difficulty), `waveFor(n, twist)`,
  `waveCounts(n, twist)`, `waveBonus`, `START`, `REGROW`/`regrowCost`, `BOONS`/`Boon`,
  `BOON_INFO`, `BOON`, `boonOffer`, `TWISTS`/`Twist`, `TWIST_INFO`, `GARDEN_TWISTS`,
  `THORNY_STARS`, `LEAN_SAP`, `TWIST_SEEDS`, `DAILY`, `Plot`, `dailyPlot`, `WEEK_TWISTS`, `Week`,
  `weekOf`, `weeklyGarden` and `PLOT`. Every name and blurb in the catalogues (golems, with `lower` for
  inside a sentence, the hedge, forms, targets, boons and
  twists) is a `TextKey`, shown with `t`.
- `game/state.ts`: `GameState`, `Golem` (with `form` and `target`), `Hedge`, `Pest` (with `stunMs`,
  `stunGuardMs` and `hits`), `Spores`, `Shot` (with `ring`),
  `Pop`, `Called`, `Settled`, `Slime`, `SHOT_MS`, `RING_MS`, `Extras`, `newGame(best, bloom, garden, stars, thorny, laurels, extras)`
  (`extras`: `wild`, `grafts`, `daily`, `weekly`, `plot`; it picks the first open golem seed),
  `ordinary`, `gardenOf`, `totalStars`, `gardenOpen`, `thornyOpen`, `twistOf`, `boonCount`, `barred`, `unlocked`, `seedCost(s, kind)`, `formsFor`,
  `lastWave`, `dailyScore`, `laurelsFree`, `canGraft`, `select`, `golemAt`, `hedgeAt`,
  `freeSoil`, `freePath`, `canPlant`, `plant`, `upgradeCost`, `picksForm`, `upgrade(s, g, form)`,
  `boonedStats`, `statsOf(s, g)`, `setTarget`, `nextTarget`, `uprootValue`, `uproot`, `canMove`, `move`, `neighbours`,
  `comboAt`, `slimed`, `queenOnPath`, `canCallEarly`, `nextWave`, `regrowPrice`, `canRegrow`, `regrow`, `sunRow`,
  `compostCap`, `takeBoon`, `startWave` (returns `'start'`, `'early'` or null) and `tick`. No Phaser.
- `game/save.ts`: `loadBest`/`saveBest`, `loadBloom`/`saveBloom`, `loadGarden`/`saveGarden`,
  `loadThorny`/`saveThorny`, `loadStars`/`saveStars`, `loadLaurels`/`saveLaurels`, `loadWild`/`saveWild`,
  `loadGrafts`/`saveGrafts`, `loadWeekly`/`saveWeekly` and `loadPlots`/`savePlots` (`SavedPlot`).
- `art/clay.ts`: the claymation toolkit. `bake` paints a texture in art units (2 per view pixel)
  around an anchor, on a canvas `sharpRes` times the view size (at most `MAX_RES` = 2), and adds it
  with `addSharp`, which marks the texture's resolution so images show it at its view size; `clay` shades any path as
  plasticine (shadow, top-left light, rim, fingerprint, glint), with `E`, `R` and `Pp` for
  ellipses, rounded rectangles and blobs; the palette `C`; the seeded `rnd` and `reseed`; and the
  painters `drop`, `flower`, `golem` (all five; the fungus wears a spotted cap, the bell a brass bell), `sprout` and `pest` (all seven pests; the queen is the slug
  at 1.7x with a crown), ported from the approved mockup's
  drawing script.
- `art/textures.ts`: `bakeTextures` (every texture, listed at the top of the file: `bg-0`, `spores`, `shot-bell` (the ring),
  `tree`, `bud`/`bloom`, `golem-<kind>`, `sprout`, `hedge`, `pest-<kind>`, `mound`,
  `slime`, `slow`, `shot-<kind>`, `sap`, `glow`, `splat`, `leaf`, `card-<h>[-dim]` (one per
  height in `SEED_BUTTONS.hs`), `rim-<h>`,
  `card-locked`, `btn-wave[-off]`, `menu`, `chip[-off]`, `speed[-on]`, `pill`,
  `gcard[-rim|-locked]`, `graft[-rim|-dim]`, `btn`), `bakePlot` (a drawn plot's `bg-plot`, afresh each time), `bakeGarden` and `gardenBg` (each garden's `bg-<n>`, baked when
  it is first planted), `bakeTable` (the `table` over the whole view with the HUD strip and its
  tags across its top, and `edge`, the table from the view's left edge to the board, which hides
  pests coming in; baked by `GameScene` once it knows the view) and `TREE_FLOWERS`, where the five
  flowers sit on the tree. A garden's static scene over the table (garden slab, paths, soil beds,
  panel slab, preview pad) is its one `bg-<n>` texture, transparent where the table shows.
- `ui/Button.ts`: `makeButton`, the clay button used by the garden picker's Back.
- `trophies/`: the game's ten trophies (`shared/trophies.ts`). `index.ts` lists them (`trophies`:
  id, tier, icon, `hidden` for Thorny laurel) with their texts in `trophies/i18n/` (`en.ts`,
  `de.ts` and `en-US.ts`, only "Good neighbors": the name keyed by the id, what earns it by
  `<id>Text`), and imports nothing else from the
  game, since the hub loads it for its trophy shelf. `main.ts` hands `trophies` to `setupGame`, which
  lists them on the start and pause screens. `check.ts` holds each trophy's condition on the
  `GameState` (`EARNED`: `firstWave` best at least 1, `combo` a grown golem with a combo, `form` a
  golem with a form, `bloom` the full bloom, `queen` `queenSquashed`, `harvest` any star,
  `perfectHarvest` three stars, `allGardens` a star in every garden, `laurel` any laurel) and
  `checkTrophies(state)`, which `GameScene.update` calls after the tick; the first call after the
  page loads awards quietly, so saved best, bloom, stars and laurels earn theirs without a toast.
  `boldCall` is awarded in `update` for a `state.settled` entry whose `clean` is set (no leaf lost
  between the call and the end; `Called.lost` is set by any bite after the call, so a Leaf boon
  taken in between doesn't hide it). A new trophy is an
  entry in `index.ts`, its two texts in each language file and its condition in `EARNED`.

Shared code it imports (outside the game folder): `shared/setupGame.ts` (`setupGame`),
`shared/scaling.ts` (`setupScaling`, `sharpRes`, `viewSize`, `viewFrame`), `shared/settings.ts` (`byDifficulty`,
`settings`), `shared/i18n.ts` (`translator`, `byLanguage`, `formatNumber`), `shared/audio.ts` (`sounds`, `ui`,
`playMusic`, `playSting`), `shared/daily.ts` (`dailyRand`, `startDaily`, `finishDaily`, `loadDaily`) and `shared/trophies.ts` (`trophySet`, `award`).

Screens: `setupScaling` gives the canvas `renderScale` canvas pixels per game pixel (up to 4 on a
4K screen) and zooms the one camera to match from its top-left. With `fill: true` the view takes
the screen's shape (960 to 1344 wide, 560 to 720 tall). Everything is still laid out for the
designed 960x560 frame (`VIEW`; the HUD, board and panel fill its top 540 pixels, and the 20
below keep the shared corner buttons, about 12 to 78 by 498 to 528 CSS pixels in a 960x540
window, off the board's bottom row, whose cells end at y 512): `GameScene.create` takes `viewFrame(this)` as `frame`
(moved by `clearCorner` when the buttons, which keep their CSS size, would still cover the board's
bottom-left cell, as on a phone on its side: first up, as far as the view's top, then right, as far
as its right edge; `cornerSize` measures the buttons in view pixels; `relayout`, on the scale
manager's `resize` event, places the frame again when the window is resized, a phone that started
upright is turned or full screen changes, and moves the camera, the HUD, the `viewObjects` and the
button rectangles to match, with `bakeTable` painting the table again for the new offset) and scrolls the camera
to `-frame.x, -frame.y`, so the board, panel, banner, golem menu and the overlays (centred on
`VIEW.w / 2`) sit in the middle of the view, and world coordinates stay the designed ones. Around
them, the `table` image (at `-frame.x, -frame.y`, the view's size from `viewSize`) fills the view
and carries the HUD strip across its top; the HUD's objects are moved up by `frame.y` after
`createHud`, so the HUD stays pinned to the view's top edge (and so does the sap droplets' target).
The overlays' dim covers the whole view, and `seedButtons` and `waveButton` add the frame's offset
so they stay in view pixels. At 960x560 the frame is the whole view and nothing moves (a 960x540 window shows a 996x560 view, the frame 18 pixels in from each side). Text and Graphics draw at the
full `renderScale`. The clay is painted at `sharpRes`, held to `MAX_RES` (2) in `clay.ts`, since
its blur-filter shadows cost about the cube of the resolution at start-up. `addSharp` sets the
texture source's `resolution` and trims its frame to the view size, so every `add.image`,
`setScale` and origin stays in view pixels. `e2e/screens.spec.ts` at the root opens the game on
five screens.

How it runs:

- `GameScene.update` takes game time from the frame's timestamp (clamped to `MAX_STEP_MS`) and
  calls `tick` (with twice the time when `fast`), which plays it in steps of at most 16ms. Each
  step: shots and slime age, the wave's queue spawns pests whose `atMs` has come (each on the next
  route in turn), pests walk (slowed if `slowMs`; still if stunned; halted, chewing, at a hedge's stop unless
  they fly or are under ground; a mole's `under` is set in its tunnel; the queen slimes the cells
  round her), pests past their route's `length` bite the Heartwood, chewed-through hedges go,
  spore patches age and poison the pests in them, seeds grow, grown golems off cooldown (slower on slime) throw at the pest their `target` picks
  (`pickTarget`) within `statsOf(g).range` and not `under` (an `area` golem hits every pest in
  reach; combos, armour, `pierce` and `splash` change the damage, which lands at once; the `Shot`
  is only drawn), squashed pests pay their bounty and push a `Pop`, and an empty queue with no
  pests ends the wave (`finishWave`: `waveBonus`, compost, a bud, `best`, the harvest at wave 30).
- Input: one zone over the board; `pointermove` sets `hover` (from `pointer.worldX/Y`), `pointerdown` calls `tapCell`,
  which moves the golem being moved (`moving`) there, else toggles the menu of the golem on the
  cell (`picked`), else closes an open menu, else plants (a golem on soil or a hedge on the path,
  by `selected`). The menu's chips (`menuTap`) call `upgrade` (or open the form chips for the
  raise to level 3, which call `upgrade` with the form), `setTarget`, start a move or `uproot`.
  The seed cards call `select` (refused for a locked kind; the locked thorn card's own image is
  hidden, so a tap on it does nothing), the wave button `startWave`, the speed button toggles
  `fast`, the garden tag opens the picker. The picker's dim rectangle swallows taps.
- Rendering is diffed by id: `golems`, `hedges`, `pests` (body, slow-clump and mound images),
  `shots` and `slimes` (by cell) map state ids to images, created and destroyed as the state changes; bars, level beads and the hover are
  redrawn each frame on Graphics; `refresh` rewrites the HUD, flowers, cards, preview and wave
  button. Splats, labels and droplets are fire-and-forget objects on Phaser tweens.

State model (`GameState` in `src/game/state.ts`): `garden` (index into `GARDENS`), `wave` (being
fought, or next while building), `phase` (`'build'`, `'wave'` or `'over'`), `heart`, `sap`,
`selected` (a `SeedKind`), `golems` (each with `spent`, `form` and `target`), `hedges` (each with
`hp` and `stops`), `pests` (each with `wave`, `route` and `under`), `queue`, `spawned`,
`slime`, `fast`, `waveMs`, `waveHpScale`, `shots`, `kills`, `bloom` (0 to 5), `pops` (squashed
pests not yet shown; the scene empties it every frame), `best`, `compost` (paid at the last wave's
end), `stars` (per garden), `harvest` (this garden's, 0 before wave 30), `thorny`, `laurels` (per
garden), `boons`, `sunRows`, `offer` (the boons to pick from, or empty), `queenSquashed`, `called` (waves
called early whose last pests still walk), `settled` (called waves just finished, each with `clean`; the scene
empties it), `regrown`, `cleared` (the most waves cleared in this garden), `wild` (per garden), `grafts`,
`freeSeed`, `daily` (the `Plot`, or null), `weekly` (the `Week`, or null), `plot` (a drawn plot's slot
and `Garden`, or null), `spores` and `nextId`. Golem
positions are cells; pest positions are `dist` pixels along their route. The open menu, its form
mode and the golem being moved (`picked`, `formMenu`, `moving`) are the scene's, not the state's.

Persistence: twelve `localStorage` keys, ten written by the scene: `golem-garden-best` (the most waves
ever cleared, when `state.best` rises), `golem-garden-bloom` (the Heartwood's bloom, when it rises;
kept between gardens, so the Thorn golem stays unlocked once it blooms), `golem-garden-stars`
(each garden's harvest stars, comma-separated in `GARDENS` order, when they change) and
`golem-garden-garden` (the garden last picked, which a reload plants), `golem-garden-thorny` (1
when that pick was its thorny variant) and `golem-garden-laurels` (each garden's laurel, 0 or 1,
comma-separated, when one is won), `golem-garden-wild` (each garden's best wild wave, comma-separated,
when one rises), `golem-garden-grafts` (the grafts bought, comma-separated ids), `golem-garden-daily`
(the daily record, written by `startDaily` and `finishDaily` in `shared/daily.ts`),
`golem-garden-weekly` (`<week>:<best>`, the weekly garden's best wave that week; another week's reads as 0),
`golem-garden-plots` (JSON: `PLOT.slots` entries, each null or `{ path, soil, best }`, written by the
editor and as a plot's best rises) and
`golem-garden-trophies` (the trophies earned, each id with
the time, written by `award` in `shared/trophies.ts`). The garden's golems, hedges, pests and boons are never saved.
The hub's settings are read from the shared `hub-settings` key.

Randomness and timing: no `Math.random`, `Date.now` or `performance.now`. Waves are fixed by
`waveFor`; art uses the seeded `rnd` in `art/clay.ts`; the daily plot is drawn from `dailyRand`
(seeded by the date, read when the Daily plot button is pressed). The weekly garden and the
picker's Plots note read the day through `today()` (`shared/daily.ts`) too: `create` when a weekly
garden starts (`weeklyGarden(weekOf(today()))`), and `plotsButton` and `showPlots` when the picker
or the plots overlay opens; never during play. Game time is only the frame timestamps
Phaser passes to `update`; the pops' tweens run on Phaser's clock and are cosmetic.

### Sound

Everything is in `src/audio.ts` and played by `GameScene`; `game/` has no sound. The scene finds
what the rules did in a frame by diffing the state around `tick` (`soundWatch` before,
`tickSounds` after: new shot and pest ids are those from the `nextId` before the tick), so each
sound plays at most once a frame, and nothing plays while the picker or a boon pick holds the
game still (it ticks by 0).

Music (`syncMusic`, called in `create` and every `update`, before the stings, so a sting ducks
the song that plays on): `CALM` (96 BPM, G major pentatonic, part `calm`, chords G Em C D) between waves and after the Heartwood falls; `WAVES` (132 BPM)
`battle` while a wave comes and `boss` (E minor) on a Queen Slug wave (`isBossWave`).
Changing song fades the old one; battle and boss switch at the next bar. `STINGS` (120 BPM):
`harvest1` to `harvest3` (one rising note per star) when the harvest picker opens, `lose` when the
Heartwood falls (`harvest3` instead when a daily plot ends with leaves left).

| Sound | Where it plays |
|---|---|
| `select` / buzz | a seed card or the hedge strip picked / a locked one (`select` false) |
| `plant`, `rustle` / buzz | `tapCell`: a golem seed / a hedge planted; `plant` refused |
| `grown` | `tickSounds`: a seed's `growMs` reached 0 |
| `raise` (higher per level), `form` / buzz | `menuTap`: Raise, a form chip; refused for lack of sap |
| `aim`, `move`, `uproot` + `ui('coin')` | `menuTap` (Aim, Uproot), `tapCell` (the move landing); buzz when refused |
| `pebble`, `moss`, `thorn`, `fungus`, `bell` | `tickSounds`: new shots (a bell's ring), one per golem kind a frame (70ms gap, so 2x speed doesn't double them) |
| `clink` | `tickSounds`: an armoured pest (snail) took a golem's hit (`Pest.hits` rose; spore damage doesn't clink) |
| `squash` + `sap` | `tickSounds`: `state.pops` not empty |
| `caw`, `dig`, `groan` | `tickSounds`: a crow, mole or Queen Slug came in |
| `snap` | `tickSounds`: a hedge chewed through |
| `bite` | `heartHit` |
| `horn`, `whistle` / buzz | the wave button: `startWave` returned 'start', 'early' / null |
| `cleared`, `bud` (higher per bud), `bloom` | `waveDone`: a wave cleared, or a called wave whose last pests are gone |
| `rustle` + `chime` / buzz | `regrowLeaf` (the Heartwood's cell, the leaf tag) |
| `boon` | a boon card taken |
| `boon` + `ui('coin')` / buzz | a graft bought / refused (bought, or no laurel) |
| `select` / `rustle` / buzz | the garden editor: a path cell / a soil bed drawn or taken back; a refused tap |
| `ui('click')` | the Plots button, a plot or weekly card, an Edit tag, the editor's tool tags and Back, opening a golem's menu, form-menu open and Back, Move chip, speed button, garden tag, garden and thorny cards, the picker's Back, Keep going, Daily plot (buzz once played) and Grafts, the grafts' Back |

### Hub settings

- `src/main.ts` calls `setupGame(game)` right after creating the game: frame cap, FPS readout, reduced motion and full screen (the camera shake when a pest reaches the Heartwood becomes a no-op).
- Difficulty scales pest health: `PEST_HP_SCALE = byDifficulty(0.75, 1, 1.3)` in
  `src/game/data.ts`, folded into each wave's `hpScale`. Keep the Golem Garden row of the root
  README's difficulty table and the README's line in step.
- `settings.reduceMotion` also turns off the white hit flash on pests, the warm flash on the
  Heartwood and the crows' bobbing, and in `sapPop` keeps the "+N" label still (it only fades) and
  skips the flying droplets and the sap counter's glow.
- Keep Normal exactly as designed: the playthrough runs on Normal.

## Testing hooks

- `src/main.ts` exposes `window.game` in dev builds. The test reads `game.scene.getScene('Game')`
  and its `state` (copied through JSON), `seedButtons` (`{ kind, x, y, w, h }` per card),
  `waveButton` (`{ x, y, w, h }`), all in view pixels, and `waveLabel` (the wave button's text on
  one line, such as `Start wave 1` or `Call wave 2 now, +15 early`). `waveLabel` is in the
  player's language; the playthrough runs in British English, the default language, so it reads the English
  `startWave`, `callWave` and `earlyBonus` texts. It also reads the view's width (the main
  camera's width over its zoom) and the private `frame`'s `x` and `y`.
- Inputs: it clicks the seed cards, cell centres (`GRID` plus the frame's offset; a 960x540 window
  shows a 996x560 view) and the wave button, scaling view pixels by the canvas bounding box. It never plants a hedge, raises a golem or opens the menu: forms,
  targeting, hedges, compost (from wave 3) and the harvest (wave 30) stay out of its first round.
- The test mirrors these, so change them together: the `GameState` fields it reads, `GRID`,
  `START`, the Meadow's path (the playthrough plays it, with no saved keys), the pebble seed's cost and grow time (`PEBBLE`), wave 1's beetle count, bounty
  and bonus (`WAVE_1`), `EARLY_BONUS`, the wave button's labels, the cells it plants on (`PLANTS`,
  inside the path's bends) and a path cell (`PATH_CELL`). It also checks the thorn card picks
  nothing while locked, the early-call label once wave 1's queue is empty (it does not take it),
  and `bloom` going from 0 to 1 when wave 1 is cleared, and that clearing it earns only the Green
  thumb trophy (`golem-garden-trophies` holds just `firstWave`; a trophy a first round can reach in
  another way, like a combo, would break that). Moving the path, weakening the pebble
  golem or toughening wave 1 can make the two golems miss a beetle; the test then fails on `heart`.
- It saves `playthrough-0-start`, `-1-sprout`, `-2-wave` and `-3-cleared` screenshots; copy them
  into `docs/screenshots/` with the `playthrough-` prefix when the look changes.

## Making common changes

- **Retune a golem or pest**: its row in `GOLEM_INFO` or `PEST_INFO`, the README tables, and the
  test's constants if it is the pebble golem or the beetle.
- **Add a golem**: add it to `GOLEMS` and `GOLEM_INFO`, give it two forms in `FORMS` and
  `FORM_INFO` (`of` it), give `golem()` in `src/art/clay.ts` its look, bake `shot-<kind>` in
  `src/art/textures.ts` (`golem-<kind>` follows `GOLEMS`), give `sfx` in `audio.ts` its throw, and
  add a card to `SEED_BUTTONS.ys` and `hs` before the hedge strip (the panel is full with five; the
  preview or the hint would have to shrink).
- **Retune the weekly garden or plots**: `WEEK_TWISTS`, `weeklyGarden`, `TWIST_SEEDS` and `PLOT` in
  `data.ts`, `EDITOR` in `layout.ts`, and the README's sections.
- **Retune a form, targeting, the hedge, compost or the harvest**: `FORM_INFO` (its multipliers
  and flags), `TARGET_INFO` (names and hint text), `HEDGE` and `CHEW_PER_BITE`, `COMPOST`, and
  `HARVEST_WAVE` and `STAR_LEAVES` in `data.ts`; `HEDGE_STOP` in `state.ts`; the gardens'
  `unlockStars` in `board.ts`; and the README's tables.
- **Add a pest**: add it to `PESTS` and `PEST_INFO`, give `pest()` in `clay.ts` its look (bake it
  as `pest-<kind>` in `textures.ts`; it is used in the preview too, which fits six kinds), its
  health bar height in `PEST_TOP` if it is not slug-sized, and give it spawns in `waveFor` (from
  wave 2 or later, so the playthrough's wave 1 stays beetles only). Add its README row.
- **Add a garden**: a `garden(...)` entry in `GARDENS` with its corner lists (straight runs,
  starting off the left edge at col -1, every route ending on the same Heartwood cell). The
  background, picker card and mini map follow; `GARDEN_CARD` fits three cards side by side.
- **Retune combos, the boss or the menu's prices**: `COMBO`, `BOSS_EVERY` (and `WILD.bossEvery`), `SLIME`, the queen's
  `PEST_INFO` row, `UPROOT_REFUND` and `MOVE_FEE` in `data.ts`, and the README.
- **Retune boons, regrowing or thorny variants**: `BOON` (numbers), `BOON_INFO` and the order of
  `BOONS` (`boonOffer` takes them three at a time), `REGROW`, `TWIST_INFO`, `GARDEN_TWISTS`,
  `THORNY_STARS` and `LEAN_SAP` in `data.ts`; the boon cards' detail line is `boonDetail` in
  `GameScene`; and the README's tables.
- **Retune the wild garden, grafts or the daily plot**: `WILD`, the third forms' `FORM_INFO` rows,
  `GRAFTS`/`GRAFT_INFO` (four cards fit at `GRAFT_CARD`'s width), `DAILY` and `dailyPlot` in
  `data.ts`; the README's sections and tables.
- **Change the bloom goal or early bonus**: `BLOOM_GOAL` and `EARLY_BONUS` in `data.ts`. The HUD
  draws `BLOOM_GOAL` flowers but the tree has five spots (`TREE_FLOWERS`), and the test's
  `EARLY_BONUS` mirrors the bonus.
- **Change a path**: edit its garden's corner lists in `GARDENS`; the `map` and the painted path
  follow. For the Meadow, re-pick the test's `PLANTS` and `PATH_CELL`.
- **Add or change a text**: add its key to `i18n/en.ts` and its German to `i18n/de.ts` (the build
  fails on a missing key), and its US spelling to `i18n/en-US.ts` if it differs; show it with
  `t(key, vars)`, numbers as `{placeholders}` so they are formatted for the language. Compare ids,
  never translated text. Run `node scripts/check-translations.mjs`, and look at the German on
  screen (`?lang=de`): the seed cards, menu chips and hint are narrow.
- **Restyle**: shapes live in `clay.ts`, placements and the static `bg` in `textures.ts`; texture
  sizes and anchors there must match the origins in `GameScene` (`GOLEM_ORIGIN`, `PEST_ORIGIN`,
  the sprout's and the tree's origins).

## Gotchas

- A texture added outside `bake` (like `edge`, cut from `table`) goes through `addSharp` with its canvas's
  resolution, or it shows `res` times too big. A canvas filter works in canvas pixels: build it
  with `blur`, which scales by the canvas's resolution.
- `pointer.x/y` and `this.scale` are canvas pixels, `renderScale` times view pixels; read pointers
  through game objects' own events or `pointer.worldX/Y` (the camera scrolls by the frame's offset).
  Lay out in the designed frame (`VIEW`, `layout.ts`); something that must reach the view's edges
  goes from `-frame.x, -frame.y` at the size of `viewSize`, and HUD objects are moved up by `frame.y`.

- `SEED_BUTTONS.ys` and `hs` are indexed in `SEEDS` order; every golem card uses the one compact
  layout (its texts shrink to fit the card), and the hedge strip has its own.
- Read a garden's map through `gardenOf(s)`, never `GARDENS[s.garden]`: a drawn plot isn't in
  `GARDENS` (its `s.garden` is 0). Keep stars, laurels, wild records and the harvest to `ordinary(s)`.
- The menu's chip `i` means different things in form mode (each of `formsFor`'s forms, then Back)
  and out of it (Raise, Aim, Move, Uproot); `refreshMenu` and `menuTap` agree on that order.
- A hedge's `stops` are fixed when it is planted, from the garden's routes; a pest exactly at a
  stop keeps chewing because the halt test is `dist <= stop <= next`.
- `startWave` during a wave returns null until the queue is empty, while a Queen Slug walks, and
  always on wave 30 (and on the daily plot's last wave). The scene shows the "called
  early" banner itself (from the click), while a natural clear is spotted in `update`.
- A golem's damage lands when it throws; the shot image is cosmetic, so a pest can vanish before
  the rock arrives.
- `tapCell` opens the menu whenever the cell has a golem, so planting never replaces one; with a
  menu open, a tap on another golem switches the menu to it, and a tap anywhere else only closes
  it. A seed card closes the menu, so the next tap on soil plants.
- The scene saves `best` and `bloom` on any rise (in `refresh`, so a called wave counts once it ends);
  `newGame` reads them back on restart.
- Picking "furthest along" (`first` targeting) compares the share of each pest's route walked,
  since a forked garden's routes can differ in length.
- `saveStars` writes the whole list, so a garden's stars never go down (`finishWave` takes the
  max); the picker is rebuilt on each open, so new stars show at once.
- A pest's texture origin is `PEST_ORIGIN`, except the bigger queen's (`QUEEN_ORIGIN`).
- Read a golem's stats with `statsOf(s, g)` (or `boonedStats` for a ghost), never `golemStats`
  alone, so boons count; Sunny row depends on the row, so moving a golem changes its reach.
- `newGame` ignores `thorny` for a garden without `THORNY_STARS` stars, so a stale thorny key
  plants the plain garden.
