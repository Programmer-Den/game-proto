# Broadside: guide for agents

This file explains how this game is built and where it stands, for agents about to change it.
`README.md` covers how to play, the captain's orders, the enemy ships and the upgrades. Keep this
file up to date with any change to the game, as the root `AGENTS.md` asks.

## Current state

A wave-based naval battle drawn as an old hand-tinted sea chart. The player's ship always sails
forward. The player steers with the helm (turn left, turn right, or let go) and fires each
broadside by hand: holding a side's fire control charges it, letting go fires it, and a longer
charge reaches further and hits harder. Each wave has one captain's order (a bonus for the wave)
and a wind, and from wave 2 an Admiralty bounty. Sunk enemies drop loot barrels, crippled ones can
be boarded and taken as escorts (which costs crew), and gold buys upgrades and sailors at a harbor
between waves, where a prize draft offers a perk for the run and each side's guns are loaded with a
kind of shot. From wave 6 islands carry shore forts and the harbor offers two courses for the next
wave (Merchant lane or Hunter patrol); from wave 7 every third wave is a convoy wave, a merchantman
to see safe to an island. Prizes can be kept as consorts that sail on from wave to wave, and late
drafts offer a perk's second rank. Wave 20 is the pirate haven, whose admiral's
flagship wins the campaign when sunk. Between runs, the Admiralty's medals buy starting upgrades
and the player chooses a ship.

- **Implemented:** endless waves (sloops from wave 1, brigs and fireships from wave 3, mortar
  ketches from wave 4, galleons from wave 5, a flagship last in every fifth wave, the admiral's
  flagship, `admiral`, last on `HAVEN_WAVE` 20) with enemy hull scaling per wave. Prize draft
  (`src/game/perks.ts`): `reachHarbor` sets `GameState.draft` (`FIRST_DRAFT` after wave 1, else
  `drawDraft` of up to `DRAFT_SIZE` perks not in `GameState.perks`), the harbor shows the cards
  over the ledger until `pickPerk` moves one to `perks` and empties `draft` (`setSail` refuses
  while a draft is open); the perks' rules live in `sim.ts` (`ricochet` in `fire`/`moveBalls`
  via `Ball.skip`, `salvage` in `sink`, `gunners` in `escortBroadsides`, `mortar` in `ownMortar`
  with `GameState.mortarMs`, which holds fire while `safeSpot` says the landing spot is near the
  player, where she will be, or a prize (a prize mortar ketch in `escortBroadsides` checks it too), `grapnels` in `boardMs`/`prizeCrew`, `swivels` in `stats().arc`,
  `carronades` in `firePlayer`). Perk ranks: `perks` lists a perk once per rank taken
  (`perkRank`, `MAX_PERK_RANK` 2); `drawDraft(taken, size)` fills the draft with new perks first
  and then the second rank of held ones, and each perk's numbers are arrays by rank read through
  `perkValue(s, id, values, none)` in `state.ts` (Bouncing shot's rank is `Ball.bounces`).
  Courses (`src/game/courses.ts`): when `coursesFor(s.wave + 1)` (from `FIRST_COURSE_WAVE` 6, not
  the haven) the harbor shows `sail-merchant`/`sail-hunter` instead of `sail`, and `setSail(s,
  course)` refuses a missing or unwanted course and sets `GameState.course`; `waveShips(wave,
  course)` adds `MERCHANTS` merchantmen or `HUNTER_BRIGS` brigs, `lootOf` doubles on the Merchant
  lane, and `reachHarbor` draws `HUNTER_CARDS` more cards after a Hunter patrol. Merchantmen
  (`role: 'merchant'`, no guns) run from the player in `captain` and get away when
  `Ship.escapeMs` (set in `spawn` to `ESCAPE_MS`) runs out (`escape`, an `escape` effect, no
  loot). Consorts (`src/game/consorts.ts`): `reachHarbor` sells every prize but keeps it in
  `GameState.moored` (richest first); `keep` buys `moored[0]` back for `keepCost` (her sale price),
  sends `prizeCrew` across, patches her by `HARBOR_PATCH` and puts her in `consorts` with `Ship.kept`, `keepBlocked` says why it
  can't (`none`, `full` at `CONSORT_MAX`, `gold`, `crew`); `setSail` moves `consorts` into
  `escorts` (`station`: in line astern, further back if an island is in the way), and the next `reachHarbor` pays `consortWage` each (into
  `wages`) and patches them, or sells one it can't pay. Convoys (`src/game/convoy.ts`): on
  `isConvoyWave` `setSail` adds a `merchant` to `escorts` and sets `GameState.convoy` (her id, an
  island at least `CONVOY_FAR` off, `convoyCargo`, `state`); `sailConvoy` steers her for the island
  (`planDetour`, `fend` and `shoalAhead` skip that island) at `CONVOY_SAIL` of her speed
  (`speedOf`), `sailEnemy` sends sloops and fireships after her (`convoyShip`), `arrive` pays the
  cargo within `CONVOY_ARRIVE` of the beach, `tick` marks her `lost` once she is gone from
  `escorts`, and the harbor waits while she is `sailing`. Shore forts (`GameState.forts`, `Fort`, `FORT` in `state.ts`):
  `setSail` places `fortsFor(wave)` of them on islands drawn at random, `fortsFire` lobs shells at
  the player in range, the player's and prizes' balls and any blast batter them in `moveBalls`
  and `blast`, and `raze` pays `fortBounty(wave)`; the wave is beaten without them, and `setSail`
  clears them. The haven: when wave `HAVEN_WAVE` is beaten and `won` is false, `tick` sets `won`,
  phase `won` and `medals` (`medalsFor` plus `WIN_MEDALS`; `medalsBanked` remembers only the
  `medalsFor` part, so `playerSunk` awards only the waves beaten since), and the end card's "Sail on" (`sailOn`) goes to the harbor.
  Ships (`src/game/hulls.ts`): `GameState.hull` picks the `HULLS` row `stats()` starts from (the
  frigate is the old `PLAYER`), `unlocked` by best wave, chosen on the end card and passed to
  `newRun`; a `mortarSide` (the Bomb Ketch's starboard) makes `firePlayer` `lob` a shell to where
  the arc reaches instead (pushed out until the burst clears her hull now and where she will be), `loadShot` refuses that side and the harbor shows it as a mortar.
  Bounties (`src/game/bounties.ts`): `setSail` draws `GameState.bounty` from wave
  `FIRST_BOUNTY_WAVE` (2), the wave's trackers (`waveLoot`, `waveDamage`, `waveAground`,
  `wavePrizes`, `waveMs`, `waveSunk`, which `sink` and `board` both add to) feed
  `BOUNTIES[id].met`, and `reachHarbor` pays `bountyPay` (half `waveLoot`) into `bountyPaid`.
  Crew (`Ship.crew`/`maxCrew`): `crewPace` scales every reload step (`reloadStep`, `aimBroadsides`), grapeshot pellets `kill`
  `GRAPE_KILLS` and blasts `BLAST_KILLS`, ships with `grape` in `ENEMIES` fire grapeshot within
  `GRAPE_RANGE`, `board` needs `canBoard` and moves `prizeCrew` sailors across (`crewBack` on
  scuttling or selling), and `hire` at the harbor buys `HIRE.crew` for `HIRE.cost`. Fireships (`role: 'fireship'`) sail straight at the player and blow up on
  touching the player or a prize (`ram`, no loot) or when sunk (`sink`); the blast (`blast`) hurts
  every ship near, enemies included. Mortar ketches (`role: 'mortar'`) keep to long range and lob
  shells (`mortar`, `GameState.shells`) at where the target will be in `SHELL_MS`; the scene marks
  the spot and `landShells` blasts it. Wind (`GameState.wind`, a heading): `windSpeed` scales every
  ship's speed by its heading against the wind and `windReach` lengthens shot fired downwind (ball
  lifetime in `fire`, the player's targeting in `firePlayer` and the arcs drawn); wave 1's wind is
  `FIRST_WIND` (blowing east), later waves draw one of eight points in `setSail`. Boarding
  (`board`): an enemy at or under `BOARD_HP` of its hull is `boardable` (not fireships), sails at
  `CRIPPLED` of its speed, and is taken once the player stays within `BOARD_REACH` hull to hull for
  `BOARD_MS` (`Ship.boardMs`); it moves to `GameState.escorts`, patched to half its hull, and sails
  with the player (`sailEscort`: goes after the nearest enemy within `ESCORT_HUNT` of the player
  with the enemy captain's logic, `captain`, otherwise keeps station) and fires at enemies
  (`escortBroadsides`). Enemy broadsides fire at the player or a prize. `scuttle` sinks a prize for
  twice its loot; prizes left at the wave's end are sold for their loot in `reachHarbor`. Loadable
  shot (`src/game/shot.ts`): `GameState.loadout` per side, cycled at the harbor by `loadShot`; the
  chain and grape orders load both sides for the wave instead (`loadedShot`); grapeshot has
  `range: 0.7` (`sideRange`) and a hit sets `Ship.jamMs`, slowing that ship's reload. Admiralty
  rewards (`src/game/admiralty.ts`): `playerSunk` sets `GameState.medals` (`medalsFor`: one per
  wave beaten, `BEST_BONUS` more for beating `bestBefore`), the scene banks them, and the game-over
  panel spends them on `BOONS` passed to `newRun` on "Sail again". Hold-to-aim broadsides for the player (`aim` and `charge` in the
  state, `aimBroadsides` and `firePlayer` in `sim.ts`); enemy broadsides still fire on their own.
  Captain's orders (`src/game/orders.ts`): the first wave is always chain shot (`FIRST_ORDER`),
  later waves draw a different one from the last in `setSail`; the order changes the player's
  stats in `stats()`, the player's shot (`Ball.shot`), and with chain shot slows ships hit
  (`Ship.slowMs`). Enemy AI closes in, turns to bring a broadside to bear and bears away rather
  than ram; while closing in it plans a course round an island in the way (`Ship.detour`, drawn
  as a dotted line), and a lookout bears off any beach ahead and shortens sail to come about in
  time. Broadsides lead their target, and enemy aim has a random spread. Loot drifts toward the
  player and expires; when a wave's last enemy sinks, every barrel still afloat is hauled in at
  once. There is a harbor shop with five upgrades plus a paid repair, the hire and keep rows, the two
  loading buttons and the sail (or course) buttons, a
  game-over panel with the Admiralty's rewards and "Sail again", and off-screen arrows pointing to
  enemies (rust), prizes (green) and loot (ochre). The sea wraps around at every edge
  like a globe: sailing off the north edge comes back in at the south, and off the west edge in at
  the east. Ships, balls and loot all wrap, and every distance and bearing takes the shortest way
  round. Islands have collision: any ship, player or enemy, that sails onto an island's beach is
  pushed off, glances away and takes `AGROUND_DAMAGE`.
- **Screens:** there is only `GameScene`. The wave banner, the captain's order card, the bounty
  line, the wind rose, the scuttle button, the harbor panel (ledger or prize draft) and the
  game-over panel (also the haven's end card) are overlays drawn on top of it. The start and pause
  screens, the sound button and the P key come from `setupGame` (`shared/startScreen.ts`); the other
  shared settings (difficulty, frame cap, FPS readout, reduced motion and full screen) are set on the
  hub page.
- **Persistence:** the best wave beaten, the banked medals and the ship chosen are saved. Each
  run starts fresh at wave 1, plus any starting upgrades bought with medals.
- **Trophies:** nine (`src/trophies/`, `shared/trophies.ts`), listed on the start and pause
  screens and on the hub (see the file map). The first round earns First blood.
- **Sound:** music and sound effects, made in code (see "Sound" below).
- **Rough or unused:** Enemy captains still run aground now and then (pushed by
  another ship or the player, or cornered at close range), far less often than before the
  steering: a long scripted fight of wave-6 fleets saw 3 groundings where plain chasing saw 41.
  Detours are planned round one island at a time (the nearest blocking one). Medals can only be
  spent, and the ship changed, on the game-over panel, so a freshly loaded page can't spend
  banked medals until a run ends (it does sail the ship chosen last). There are no TODO comments
  in the code.

## Architecture

File map (all under `src/`, plus the shared files it imports):

- `howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English, US English and German, picked with `byLanguage` and handed to `setupGame(game, { howToPlay })`
  in `main.ts`; update all three when the controls or the first round change.
- `i18n.ts` and `i18n/`: every on-screen text (`shared/i18n.ts`). `i18n/en.ts` is the British
  English source, `i18n/de.ts` the German (typed `Translation<typeof en>`, with `keepEnglish` for
  texts that stay the same) and `i18n/en-US.ts` only the US spellings (`harbor`). `i18n.ts`
  exports `t` and `TextKey`. The tables in `game/` hold `TextKey`s, never text: `name`/`desc` in
  `HULLS`, `UPGRADES`, `BOONS`, `SHOTS`, `PERKS` (and `desc2`), `COURSES`, `ORDERS` (`title`),
  `ENEMIES` (`name`, and `called` for a ship named mid-sentence, lower case in English),
  `BOUNTIES` (`desc`, filled with `vars(s)`) and `ISLANDS`; `windFrom` returns a compass point's
  key (`windW`). The scene, `Harbor` and `art.ts` show them with `t`, and game logic compares ids only.
- `main.ts`: creates the `Phaser.Game` (960x540 from `DESIGN`, `Scale.FIT`, `pixelArt: false`, three active
  pointers for two-thumb play) with `BootScene` and `GameScene`, calls `setupGame(game)` and
  `setupScaling(game, { fill: true })` (`shared/scaling.ts`) and exposes `window.game` in dev builds.
- `scenes/BootScene.ts`: calls `fitLayout` with `viewSize`, then `bakeAll`, and starts `Game`.
- `scenes/GameScene.ts`: owns the run's `state`, reads input (`readInput`), calls `tick` each
  frame and draws everything (HUD, order card, helm wheels and fire controls with their charge
  rings, wakes, detour courses, effects, firing arcs, harbor and game-over overlays).
- `audio.ts`: the songs (`HARBOR_SONG`, `BATTLE_SONG`, `STINGS`) and the sound table `sfx`
  (`shared/audio.ts`). See "Sound" below.
- `scenes/soundCues.ts`: `SoundCues`, which compares the state before and after each `tick` and
  plays the sounds and music for what changed, so `game/` stays free of audio.
- `scenes/layout.ts`: `DESIGN` (960x540), `VIEW` (the real view, set by `fitLayout`), `fitLayout`, `BANNER` (the wave banner's heights), `HUD_HEIGHT`, the `HELM` wheel centres (high enough to clear the
  shared corner buttons at the bottom left), the `FIRE` control centres,
  `ORDER_CARD`, `BOUNTY` (the bounty line's left edge), `CONVOY` (the convoy's line under it), the
  `HARBOR` panel and row geometry (with `loadY` for the loading buttons), `COURSE` (the two course
  buttons), `DRAFT` (the prize draft's cards), the `OVER` (game-over)
  panel, its ship buttons (`shipY`, `shipW`) and rows, `WIND` (the wind rose), `SCUTTLE`,
  `BUTTON`, `UI_DEPTH` and `FONT` (a Georgia serif stack, no web fonts).
- `game/state.ts`: types, the world and timing constants (including `CHARGE_MS`, `REACH_MIN` and
  `CHARGE_DAMAGE`), `stats()` (the player's stats from the hull, upgrades, perks and the wave's
  order, including `arc`), `perkValue` (a perk's number at the rank held), `crewPace`, `reachOf`, `newShip`, `newRun` (with the Admiralty's
  boons and the hull), `FIRST_ORDER`, `loadedShot`, `sideRange`, the wind (`WIND_SPEED`,
  `WIND_REACH`, `FIRST_WIND`, `windSpeed`, `windReach`, `windFrom`), boarding (`BOARD_HP`,
  `BOARD_REACH`, `BOARD_MS`, `PRIZE_CREW`, `CREW_TO_BOARD`), crew (`CREW_PACE_MIN`,
  `GRAPE_KILLS`, `BLAST_KILLS`), `FORT`, `WIN_MEDALS`, `radiusOf` and `ISLANDS`, plus the
  wrapping helpers `wrapCoord`, `wrapPoint` and `offset` (the shortest `dx`, `dy` between two
  points on the sea).
- `game/hulls.ts`: `HullId`, the `HULLS` table (name, description, `unlockWave`, the stats the
  old `PLAYER` had, `crew`, and `mortarSide` with `shell` for the Bomb Ketch), `HULL_IDS`,
  `FIRST_HULL` and `unlocked`.
- `game/perks.ts`: `PerkId`, the `PERKS` table (name, `desc`, `desc2` for rank 2), `PERK_IDS`,
  `DRAFT_SIZE`, `FIRST_DRAFT`, `MAX_PERK_RANK`, `perkRank`, `drawDraft` and the perks' numbers by
  rank (`SALVAGE_HULL`, `RICOCHET_FLIGHT`, `OWN_MORTAR`, `GUNNERS_PACE`, `GRAPNELS`, `SWIVEL_ARC`,
  `CARRONADE_DAMAGE`).
- `game/courses.ts`: `CourseId`, the `COURSES` table (name, desc for the sail button),
  `COURSE_IDS`, `FIRST_COURSE_WAVE`, `coursesFor`, `MERCHANTS`, `MERCHANT_LOOT`, `ESCAPE_MS`,
  `HUNTER_BRIGS` and `HUNTER_CARDS`.
- `game/convoy.ts`: `CONVOY_WAVE`, `CONVOY_EVERY`, `isConvoyWave`, `convoyCargo`, `CONVOY_SAIL`,
  `CONVOY_ARRIVE` and `CONVOY_FAR`.
- `game/consorts.ts`: `CONSORT_MAX` and `consortWage`.
- `game/bounties.ts`: `BountyId`, the `BOUNTIES` table (`desc` for the wave, `kind` keep or do,
  `met`, `offered`), `BOUNTY_IDS`, `FIRST_BOUNTY_WAVE`, `BOUNTY_HULL`, `BOUNTY_SHARE`, `swiftMs`,
  `drawBounty`, `bountyMet` and `bountyPay`.
- `game/orders.ts`: the `ORDERS` table (title, description, stat multipliers, `load` for the
  shot both sides fire that wave, `powder` for the powder-flash look), `ORDER_IDS` and `drawOrder`.
- `game/shot.ts`: `ShotKind`, the `SHOTS` table (`slow`, `pellets`, `pellet`, `range`, `jam`),
  `SHOT_IDS`, `SLOW_MS`, `JAM_MS`, `PELLET_FAN` and `nextShot`.
- `game/admiralty.ts`: `BoonId`, the `BOONS` table (name, description, medal cost, starting `gold`
  or upgrade `rank`), `BOON_IDS`, `BEST_BONUS`, `medalsFor` and `costOfBoons`.
- `game/sim.ts`: all rules. `tick` handles steering, spawning (never on an island), enemy AI
  (`sailEnemy` calls `captain`, with `planDetour`, `roundIsland`, `blocked`, `fend` and
  `shoalAhead`), escorts (`sailEscort`, `escortBroadsides`), separation, running aground on islands
  (`runAground`), boarding (`board`), the player's broadsides (`aimBroadsides`, `firePlayer`) and
  own mortar (`ownMortar`, with `safeSpot`), enemy broadsides and mortars (`enemyBroadsides`, `mortar`), the
  forts' shelling (`fortsFire`), `fire`, `lobAt`/`lob` (shells), balls (chain shot sets `slowMs`,
  grapeshot `jamMs` and kills crew; forts are hit too), shells (`landShells`), blasts (`blast`),
  fireships ramming (`ram`), sinking (`sink`, with Salvage, which can't save a player sunk the
  same tick), razing (`raze`, after the sinking, so a fort a fireship's blast brings down is paid
  that tick), loot (`haulIn`),
  reaching the harbor (`reachHarbor`: prizes sold and crews back, the player's broadsides
  reloaded, the bounty paid, the draft set)
  and winning at the haven. `hurt` and `kill` are the only places hull and crew are taken off.
  `detourCourse`, `speedOf`, `boardable`, `canBoard`, `prizeCrew`, `boardMs`, `scuttleGold`,
  `fortBounty`, `convoyShip`, `keepCost`, `keepBlocked`, `SHELL_MS`, `SHELL_R` and `FIRE_BLAST`
  are exported for the scene. `scuttle` is the in-battle action (never the convoy); `pickPerk`,
  `buy`, `repair`, `hire`, `keep`, `loadShot` and `setSail` are the harbor actions, and `sailOn`
  the end card's.
- `game/ships.ts`: the `ENEMIES` table (name, hp, radius, speed, turn, guns, damage, reload,
  range, loot, `crew`, `grape` for ships that load grapeshot within `GRAPE_RANGE`, and `role`
  for the fireship and the mortar ketch, whose `damage`, `reloadMs` and `range` are the blast's
  or the mortar's; `merchant` for the merchantman, with no guns). `name` labels a detour course; `called` names her in the scuttle button and the harbor's keep row.
- `game/upgrades.ts`: the `UPGRADES` table, `UPGRADE_IDS`, `costOf`, `REPAIR_COST` and `HIRE`.
- `game/waves.ts`: `waveShips(wave, course)` (which ships come, in order, on the course chosen), `hpScale(wave)`, `HAVEN_WAVE`,
  `FIRST_FORT_WAVE` and `fortsFor(wave)`.
- `game/save.ts`: `loadBestWave`, `saveBestWave`, `loadMedals`, `saveMedals`, `loadHull` and
  `saveHull`.
- `trophies/`: the game's nine trophies (`shared/trophies.ts`). `index.ts` lists them (`trophies`:
  id, tier, icon, `hidden` for Terror of the seas) with their texts in `trophies/i18n/` (`en.ts`,
  `de.ts` and `en-US.ts` for Safe harbor and Strike the colors: the name keyed by the id, what earns
  it by `<id>Text`), and imports nothing else from the game, since the hub loads it for its trophy
  shelf. `main.ts` hands `trophies` to `setupGame`. `check.ts` holds each trophy's condition on the
  run in play (`EARNED`: a ship sunk, a prize taken, a bounty paid, a convoy arrived, a consort
  kept, a flagship or the admiral in `waveSunk` (sunk or taken), the harbor after wave
  `OLD_SALT_WAVE` 10, `won`, and `won` on Hard from `settings.difficulty`) and
  `checkTrophies(state)`, which `GameScene.update` calls every frame after `tick`. A run is never
  saved, so nothing is earned on load and no award needs to be quiet. A new trophy is an entry in
  `index.ts`, its two texts in each language file and its condition in `EARNED`.
- `art/art.ts`: the chart style. `SHIP_LOOKS` (size, masts, guns, sail and pennant colours for
  each hull the player can sail and each enemy kind, and `extra` for the fireship's burning
  pitch, the ketch's and Bomb Ketch's mortar and the flagships' gilded rail), `lookOf` (a ship's
  look, the player's by its hull), `ROSES`, the ink and ochre colours, and the bake functions, which paint 2D
  canvases and add them with `textures.addCanvas`: `sea` (the whole 1920x1200 sea as one chart:
  parchment, rhumb lines, hatching, islands with names, soundings and the compass rose, drawn so
  it repeats seamlessly), `frame` (screen vignette and neatline), `ship-<kind>` (hulls included),
  `fort`, `shot-round`,
  `shot-chain`, `shot-grape`, `shot-powder`, `loot`, `helm-<side>[-held]`, `fire-<side>[-held]`,
  `seal-<order>` (the merchantman's look has `extra: 'cargo'`), `order-card`, `hud-bar`, `wind-rose`, `panel-harbor` and `panel-over`. Every texture is
  painted finer than game pixels and shown scaled down by the same factor, set by `bakeAll` from
  `sharpRes` and the screen's `renderScale`: small pieces at `HI` (2 on a screen that needs no
  scaling, up to about 4 on 4K), `frame` and the panels at `SHEET_RES` (shown at `1 / SHEET_RES`),
  and `sea` at `SEA_RES`, a whole number so its copies join without a seam. A new texture is
  baked at one of these and shown at its inverse.
- `ui/Harbor.ts`: the harbor panel, a ledger on parchment. Under the title, the gold line, a line
  of news (bounty, convoy, consorts' wages) and the perks held (`II` for rank 2). Its rows are
  built from `UPGRADE_IDS` plus `repair`, `hire` and `keep`, followed by the two loading buttons
  (`load-port`, `load-starboard`) and either a "Set sail" button (`sail`) or, when `coursesFor`
  the next wave, one button per course (`sail-<course>`, `COURSE` in `layout.ts`), and a second
  container holds up to `DRAFT_SIZE + HUNTER_CARDS` cards (`draft-<perk>`, headed "Prize: rank 2"
  for a held perk, centred by the draft's length), shown instead of the ledger while
  `GameState.draft` is not empty. It records
  each visible button's screen rectangle in `buttons` (the cards while drafting, else the
  ledger's).
- `ui/Button.ts`: `makeButton`, a cream chart-label button ruled in ink.
- `ui/screen.ts`: `pinToScreen`, which sets scroll factor 0 on a container and every child, and
  `fitWidth`, which shrinks a text to a width (the HUD's "Hull" label, the harbor's news line and
  the end card's ship descriptions, which a translation or a busy harbor can make too long).
- `shared/setupGame.ts` (imported by `main.ts`) and `shared/settings.ts` (`byDifficulty`, imported
  by `game/sim.ts`, and `settings`, read by `scenes/GameScene.ts` for reduce motion): the hub's
  settings, shared by every game. See "Hub settings" below.

How it runs:

- **Boot:** `BootScene.create` paints every texture (there are no asset files), then starts
  `GameScene`. `GameScene.create` builds a fresh `newRun(loadBestWave(), boons, hull)` (the hull
  from `data`, else `loadHull()` if the best wave unlocks it, else the Frigate), the HUD, the
  order card, the controls, the scuttle button, the `Harbor` and the game-over container. "Sail
  again" saves the medals left and the ship chosen and calls `scene.restart({ boons, hull })`,
  which runs `create(data)` again, builds `newRun(best, boons, hull)` and clears the sprite maps
  and held pointers.
- **Time:** `GameScene.update(time)` computes `dt` from the frame timestamp, not from Phaser's
  smoothed delta, and clamps it to `MAX_STEP_MS` (250). It then calls `tick(state, dt)` once.
  The sim works in milliseconds. Speeds are in pixels per second and turn rates in radians per
  second.
- **Phases:** `GameState.phase` is one of `break` (wave banner for `BREAK_MS`; the player can sail
  but nothing spawns or fires, and `charge` is held at null), `fighting`, `harbor`, `over` or
  `won` (the haven's end card, which shares the game-over container; "Sail on" returns to
  `harbor`). `tick` returns early in `harbor`, `over` and `won`, after ageing effects. The harbor
  opens once `toSpawn` and `enemies` are both empty (forts don't count) and no convoy is still
  `sailing`; on that tick every
  barrel left in `loot` goes through `haulIn` (gold, `plundered`, `waveLoot` and a `coins`
  effect), `loot` is emptied and `charge`/`aim` reset, and `reachHarbor` pays the bounty and
  sets the draft. The game is over when the player's hp reaches 0 or below; `playerSunk` then
  sets `medals`, and the scene adds them to the bank (`broadside-medals`) on the phase change to
  `over` or `won`. Escorts and shells are cleared in `reachHarbor`, forts in `setSail`.
- **Input:** `readInput` sets `state.helm` to -1, 0 or 1 and `state.aim.port`/`.starboard` each
  frame. Keys win over the pointer for the helm (Left/A, Right/D); Q and E hold the port and
  starboard fire controls. Each pointer that presses a control is remembered in `held` (pointer
  id to control), and its own `pointerup` releases only that control (`gameout` releases all), so
  one thumb can steer while the other fires. A fire control pressed and released within one frame
  still counts as held for that frame (`tapped`), so a quick tap fires an uncharged broadside.
  On the scene's `RESUME` event (after the shared pause) `held` is cleared and `lastFrame` reset:
  a release made while paused never reaches the scene, so the ship would turn on, or a side charge
  forever, otherwise. Harbor rows, the draft's cards and the sail buttons call `buy`, `repair`,
  `hire`, `keep`, `pickPerk`, `loadShot` or `setSail` through `GameScene.harborAction`.
- **Broadsides:** in `aimBroadsides`, a held side whose reload has run out adds `dt / CHARGE_MS`
  to `charge[side]` (from null to 0..1). On the first tick it is not held, a non-null charge
  fires: `firePlayer` works out the reach (`reachOf`: `REACH_MIN` of the range at 0, all of it at
  1) and damage (`1 + CHARGE_DAMAGE * charge` times the base, times `CARRONADE_DAMAGE` with that
  perk inside half the reach), picks the nearest enemy within reach and within `stats().arc +
  TRAIN_SLACK` of straight out, and calls `fire` with the order's shot, pellets and pellet share
  (on a hull's `mortarSide` it calls `lob` instead, to where the target will be in `SHELL_MS`,
  as far round as the arc trains, or straight out at the reach). The shot's lifetime is `reach *
  windReach / BALL_SPEED` (plus `Ball.skip` with Bouncing shot). Then the side reloads, at
  `crewPace`. The reach starts from `sideRange` (shorter for grapeshot), and the target search
  and the drawn arc use the reach times `windReach` straight out from the side.
- **Rendering:** ships (the player's texture is `ship-<hull>`), forts, balls, loot (barrel plus
  a "Plunder" label), sinking hulks and the "+N gold" floaters are sprites kept in maps keyed by
  entity or effect id. They are created on first
  sight, moved each frame and destroyed when the id disappears from state. Wakes, detour courses,
  smoke (ink-outlined clouds), splashes, hits, the firing arcs and their aim label, HP bars, the
  slowed ring, the jammed ring of dashes, the prize's green ring, the boarding ring and its
  progress arc, shell marks, blasts, fireship smoke, the wind arrow, the HUD bars, the control
  rings and the edge pointers are Graphics, cleared and
  redrawn every frame. The HUD, order card, controls, frame and overlays use scroll factor 0.
- **Wrapping sea:** `WORLD` (1920x1200) wraps on both axes. In the sim, every move ends in
  `wrapPoint`, and `bearing` and `distance` in `sim.ts` go through `offset`, so ships chase, aim,
  separate, plan detours and pull in loot across an edge. The scene keeps `view`, the player's
  position without wrapping (moved each frame by the `offset` from `lastPlayer`), and
  `followPlayer` centres the camera on it with `setScroll`, so the camera never jumps at an edge
  and there are no camera bounds. Everything else is drawn at `place(p)`: its nearest copy around
  the player, which works because the sea is more than twice the view on each axis. The chart is
  four images of the `sea` texture in a 2x2 square, which `placeSea` moves each frame to the
  corners of the sea copy the screen's top-left (`topLeft`) is in, so they always cover the
  screen; the islands are painted into that texture, so they need no sprites.
- **Islands:** `runAground` in `sim.ts` treats each island's beach as an ellipse grown by part of
  the ship's radius. A ship inside it is moved out to its edge along the line from the centre,
  its heading is mirrored in the ellipse's normal if it was sailing in, and, unless `agroundMs`
  is still running, it loses `AGROUND_DAMAGE` hp, flashes and leaves a `hit` effect. It runs for
  every ship after `separate` while fighting, and for the player alone in `break`, so an island
  can end the run in either phase (`playerSunk`).
- **Enemy steering round islands:** an island's no-go zone for a ship is its beach grown by 0.6
  of the ship's radius plus `SEA_ROOM` (`zoneOf`). While closing in (further than 0.9 of its
  range), a captain checks whether the straight line to the player crosses a zone (`blocked`); if
  so, `roundIsland` works out both ways round in the zone's unit-circle space (tangent point,
  sweep round the coast, rough length) and `planDetour` picks the shorter, keeping to the side it
  already chose unless the other is a quarter shorter. The ship steers for a point 0.35 rad
  further round the coast than the tangent, so it follows the shore. `e.detour` holds the island,
  the side and where the ship is bound (`to`: the target's position when planned, so a sloop
  hunting the convoy draws its course toward her) for the scene, which draws `detourCourse(e)`
  dotted with an arrow and labels the first one. In every mode `fend` turns a wanted heading that would reach a beach within the lookout
  (`shoalAhead`: radius + `LOOKOUT` + the turning circle `speed / turn`) to run along the coast,
  and a ship with a beach ahead on its present heading sails at `SHORTEN_SAIL` of its speed.

State model (`src/game/state.ts`):

- `GameState` holds the phase, `hull` (`HullId`), wave, timers (`breakMs`, `spawnMs`), the
  `toSpawn` queue, `player`, `helm`, `aim` (which fire controls are held, written by the scene),
  `charge` (each side's charge 0..1, or null when not aiming), `order` (the wave's `OrderId`),
  `course` (the wave's `CourseId` or null), `convoy` (`Convoy` or null), `consorts` and `moored`
  (ships waiting in harbor), `wages` (the last harbor's, null for none),
  `wind` (the heading the wind blows toward), `loadout` (each side's `ShotKind`), `enemies`,
  `escorts` (prizes), `shells`, `forts`, `balls`, `loot`, `effects`, `gold`, `plundered`, `sunk`,
  `taken` (prizes this run), `ranks` (upgrade ranks, absent means 0), `perks` and `draft`
  (`PerkId`s), `mortarMs`, `bounty` (`BountyId` or null) and `bountyPaid` (the last harbor's pay,
  null before any), the wave's trackers (`waveLoot`, `waveDamage`, `waveAground`, `wavePrizes`,
  `waveMs`, `waveSunk`), `won`, `medalsBanked`, `bestWave`, `bestBefore`, `medals` and `nextId`.
- `Ship` has a heading in radians (0 is east, positive is clockwise on screen), `hp`/`maxHp`,
  `radius`, `crew`/`maxCrew`, per-side `reload` timers, `hitMs`, `agroundMs` (the cooldown
  before an island can damage it again), `slowMs` (chain shot) and `jamMs` (grapeshot), which
  `tick` counts down for every ship in every phase, so a ship hit just before the game ends
  doesn't stay tinted behind the panel; `boardMs` (time the player has been alongside); and
  `detour` (enemies and escorts); `escapeMs` (a fleeing merchantman's time left, else 0) and
  `kept` (a consort). The player is always id 1 with kind `player`. A prize keeps its
  id, so its sprite carries over from the enemy it was. A `Fort` has its `island` index,
  position, `hp`/`maxHp`, `reload` and `hitMs`.
- `Ball` carries its velocity, remaining `ms`, `damage`, `fromPlayer` (fired by the player or a
  prize, so it hits enemies), `shot` (`round`, `chain`, `grape` or `powder`; prize shot is always
  `round`, enemy shot `round` or `grape` up close) and `skip` (the flight after each skip off
  the water, 0 without Bouncing shot) and `bounces` (skips left, the perk's rank). A `Shell` has its landing spot, `ms`, `total` and `damage`. `Loot` has
  `gold` and `ms` to live. An `Effect` is visual only (`splash`, `smoke` with the side's
  `heading`, `hit`, `sink`, `coins`, `blast` with its `size`, `prize`, `escape` drawn as "She got
  away!").
- Only `sim.ts` functions mutate state, plus the scene writing `helm` and `aim` each frame. The
  player's derived stats always come from `stats(s)`. The stored derived values are
  `player.maxHp`, which `buy('hull')` updates, and `player.radius`/`maxCrew`, set from the hull
  in `newRun`.
- Invariant: every entity and effect id comes from `s.nextId++`, because the scene keys its sprite
  maps by id.

Persistence: `localStorage` key `broadside-best-wave` stores one number. The scene saves it when
the phase changes to `harbor`, `over` or `won`. `broadside-medals` stores the banked medals: the
run's medals are added when the phase changes to `over` or `won`, and "Sail again" saves what is
left after the chosen boons. `broadside-ship` stores the `HullId` chosen last ("Sail again"
saves it; an unknown value loads as the Frigate). Reads and writes are wrapped in try/catch, and
a stored number that is not finite and positive loads as 0 (rounded down otherwise); `loadHull`
checks `Object.hasOwn(HULLS, id)`, so an inherited key like `constructor` is unknown too.
`broadside-trophies` holds the trophies earned (`shared/trophies.ts`, each id with the time).

Randomness and timing: `Math.random` is used in `spawn` (the angle at which an enemy appears), in
`fire` (one call per shot, even for the player, whose spread is 0; grapeshot makes three per gun,
and from wave 3 brigs and bigger ships fire it up close), in `lobAt` (two per shell: ketches,
forts and the player's own mortar; the Bomb Ketch's mortar calls `lob` directly, with no spread),
and once each in `setSail` for `drawOrder`, the wind, `drawBounty`, each fort's island and a convoy's
island, and in `reachHarbor` for `drawDraft` (once per card), never before wave 1 is beaten, which is why the
first order, wind and draft are fixed and wave 1 has no bounty, forts or grapeshot from enemies.
Adding guns or shots therefore shifts the random sequence the test relies on. So does adding a
Phaser `Text` (each takes a UUID from `Math.random` when created), so a new text object in
`GameScene` or `Harbor` makes the playthrough's first wave play out differently, though just as
repeatably.
The art uses its own seeded generator (`rng` in `art.ts`), never `Math.random`. All timing comes
from `update`'s `time`. There is no `Date` or `setTimeout` in the game.

Data tables, where to tune:

- Player base stats: `HULLS` in `hulls.ts` (the Frigate is the first run's). Upgrade, perk and
  order effects: `stats()` in `state.ts`.
- Charging: `CHARGE_MS` (1000), `REACH_MIN` (0.65) and `CHARGE_DAMAGE` (0.5) in `state.ts`;
  `TRAIN_SLACK` (12 degrees) at the top of `sim.ts`.
- Captain's orders: `ORDERS` in `orders.ts`; `FIRST_ORDER` in `state.ts`. Shot: `SHOTS`,
  `SLOW_MS` (4000), `JAM_MS` (4000) and `PELLET_FAN` in `shot.ts`.
- Wind: `WIND_SPEED` (0.18), `WIND_REACH` (0.25) and `FIRST_WIND` in `state.ts`.
- Boarding: `BOARD_HP` (0.2), `BOARD_REACH` (28) and `BOARD_MS` (1200) in `state.ts`; `CRIPPLED`,
  `ESCORT_HUNT` and `ESCORT_STATION` at the top of `sim.ts`. Scuttling pays 2x loot (`scuttle`).
- Fireship and mortar: `FIRE_BLAST`, `SHELL_MS`, `SHELL_R` and `SHELL_SPREAD` at the top of
  `sim.ts`; their damage is `ENEMIES[kind].damage`.
- Admiralty: `BOONS` and `BEST_BONUS` in `admiralty.ts`; `WIN_MEDALS` in `state.ts`.
- Perks: `PERKS`, `FIRST_DRAFT`, `DRAFT_SIZE`, `MAX_PERK_RANK` and their numbers by rank in `perks.ts`.
- Courses: `COURSES`, `FIRST_COURSE_WAVE`, `MERCHANTS`, `MERCHANT_LOOT`, `ESCAPE_MS`, `HUNTER_BRIGS`
  and `HUNTER_CARDS` in `courses.ts`; the merchantman in `ENEMIES`.
- Convoys: `CONVOY_WAVE`, `CONVOY_EVERY`, `convoyCargo`, `CONVOY_SAIL`, `CONVOY_ARRIVE` and
  `CONVOY_FAR` in `convoy.ts`. Consorts: `CONSORT_MAX` and `consortWage` in `consorts.ts`,
  `CONSORT_STATION` (how far astern they set out) at the top of `sim.ts`.
- Bounties: `BOUNTIES`, `FIRST_BOUNTY_WAVE`, `BOUNTY_HULL`, `BOUNTY_SHARE` and `swiftMs` in
  `bounties.ts`.
- Crew: `crew` per hull and enemy kind, `GRAPE_RANGE` in `ships.ts`, `PRIZE_CREW`,
  `CREW_TO_BOARD`, `CREW_PACE_MIN`, `GRAPE_KILLS` and `BLAST_KILLS` in `state.ts`, `HIRE` in
  `upgrades.ts`.
- Forts: `FORT` (hp, radius, range, reload, damage, bounty and its step) in `state.ts`,
  `FORT_SPREAD` at the top of `sim.ts`, `fortsFor`, `FIRST_FORT_WAVE` and `HAVEN_WAVE` in
  `waves.ts`. Fort hp scales like enemy hp (`hpScale` and the difficulty).
- `ISLANDS` (name on the chart, centre, and `rx`/`ry`, the beach's half-widths, from which
  `bakeSea` in `art/art.ts` draws each coast), `AGROUND_DAMAGE` (8) and `AGROUND_MS` (800): in
  `state.ts`. In `runAground` the beach grows by 0.6 of the ship's radius.
- World, `BREAK_MS`, `LOOT_MS`, `LOOT_PULL`, `ARC` (broadside half-angle) and `BALL_SPEED`: in
  `state.ts`.
- `SPAWN_MS`, `SPAWN_DISTANCE`, `LOOT_DRIFT`, `ENEMY_SPREAD`, `HARBOR_PATCH`, `SEA_ROOM`,
  `LOOKOUT` and `SHORTEN_SAIL`: at the top of `sim.ts`. The loot formula
  (`loot + 2 * (wave - 1)`) is in `sink`, and the +30 hp on a hull purchase is in `buy`.
- Enemy stats: `ENEMIES` in `ships.ts`. Wave makeup and hp scaling: `waves.ts`. The difficulty
  multiplier on enemy hp is in `spawn` in `sim.ts`. Upgrade costs and
  ranks: `UPGRADES` and `REPAIR_COST` in `upgrades.ts`.

### Hub settings

- `src/main.ts` calls `setupGame(game, { howToPlay })` from `shared/setupGame.ts` right after
  creating the game, then `setupScaling(game, { fill: true })` from `shared/scaling.ts`: the canvas has `renderScale` canvas pixels
  per game pixel and the main camera is zoomed to match from its top-left corner, so `setScroll`
  still names the screen's top-left in the sea (kept as `topLeft`, since `worldView` lags a
  frame) and HUD objects at scroll factor 0 stay where they are placed, with no second camera.
  Texts are drawn at `Math.max(2, renderScale)`. The game fills the screen's shape (`fill: true`):
  the view is 960x540 or wider (up to 1296) or taller (up to 720), picked once at start.
  `BootScene` reads `viewSize` and calls `fitLayout(w, h)`, which sets `VIEW` to it and moves the
  `layout.ts` constants from their designed values: the top bar, order card, bounty, convoy line
  and scuttle button stay at the top left, the wind rose and the starboard helm and fire control
  follow the right edge, both helms and fire controls the bottom edge, and the banner and the
  harbor, draft and end panels stay centred (moved by half the growth). The frame and top bar are
  then baked at `VIEW`'s size, the dims cover `VIEW`, the camera centres the ship in `VIEW` and the
  edge pointers use its edges; the wrapping sea simply shows more of itself. At 960x540 nothing
  moves. Lay out with `VIEW` and the `layout.ts` constants (never the designed numbers, and never
  `this.scale` or `pointer.x/y`, which are canvas pixels); a new screen-fixed element gets its
  designed spot in `layout.ts` and a line in `fitLayout`. `e2e/screens.spec.ts` at the root opens
  the game on five screens.
  `setupGame` applies the frame cap, the FPS readout, reduced motion and full screen (camera shake
  and flash become no-ops; this game uses neither), the sound button and the shared start and pause
  screens.
- Difficulty scales one number: enemy hp (forts' too). `spawn` in `game/sim.ts` multiplies
  `ENEMIES[kind].hp * hpScale(wave)` by `byDifficulty(0.75, 1, 1.3)` (Easy 0.75, Normal 1, Hard
  1.3) from `shared/settings.ts`, before rounding, and `setSail` does the same for `FORT.hp`.
  The player's stats are not scaled.
- `GameScene` reads `settings.reduceMotion` itself: with it on, a ship (or fort) is not tinted
  while `hitMs > 0` (from a cannonball or running aground) and does not roll on the swell, loot holds
  still and, in its last 4s, faded at alpha 0.4 instead of blinking, chain shot does not tumble,
  the dotted ring round a slowed ship does not turn, and a fireship's smoke holds still.
- Normal must stay exactly as designed: the playthrough runs on Normal and relies on wave 1 sloop
  hp. Keep the Broadside row of the difficulty table in the root `README.md` (and the sentence in
  this game's `README.md`) in sync with the multipliers.
- The settings live under the shared `hub-settings` storage key and are read once at page load.
  They are not part of this game's save, and "Sail again" does not reset them.

## Sound

All sound comes from `shared/audio.ts`, with no audio files: `src/audio.ts` holds the songs and the
sound table, and `scenes/soundCues.ts` (`SoundCues`) plays them. `GameScene.update` calls
`cues.before(state)` ahead of `readInput` and `tick`, and `cues.after(state, dt)` right after the
tick; `after` compares the two (phase, the player's reload, charge, `agroundMs` and helm, the
convoy's state, the enemy ids) and goes through the effects whose id is newer than the last one
seen. Only effects within the screen (plus 40px) sound, and each kind at most once a frame. The
sim (`game/`) never imports audio. Under browser automation every call is a no-op, and nothing
here touches `Math.random` (the engine's pitch `vary` only runs once audio is unlocked).

Music, a sea-shanty jig in D Dorian written in 6/8 (`steps: 3`, so a written bar is two 6/8
measures), square lead, pulse "accordion" harmony, triangle bass and noise drums:

| Song, part | Tempo | When |
| --- | --- | --- |
| `HARBOR_SONG` `calm` | 66 (dotted quarters) | from `create`, the `break` before each wave and the harbor; again after the win |
| `BATTLE_SONG` `battle` | 112 | the `fighting` phase |
| `BATTLE_SONG` `boss` | 112 | while a `flagship` or the `admiral` is among `enemies` (switches at the next bar) |
| `STINGS` `wave` | 100 | `break` turns to `fighting`: drum roll and horn |
| `STINGS` `harbor` | 100 | the harbor opens (not on "Sail on" from the end card) |
| `STINGS` `win` | 100 | phase `won` (the haven razed) |
| `STINGS` `lose` | 100 | phase `over`, after `stopMusic()`; "Sail again" restarts the scene, whose `create` starts `calm` |

Effects (`sfx` in `audio.ts`, and the shared `ui` sounds), and where `SoundCues` plays them:

| Sound | Where |
| --- | --- |
| `charge` | every frame a side is held and charging, its pitch rising with the charge (gap 85ms) |
| `charged` | a side's charge reaches full |
| `cannon` + `thump` | the player's broadside (the side's reload went up): up to 3 booms 70ms apart, louder with the charge |
| `grape` | the player's broadside fired with grapeshot, over the booms |
| `distant` | a new `smoke` effect (a gun's, 600ms) on screen away from the player: an enemy's or prize's broadside |
| `mortar` | a new `smoke` effect of a lob (800ms): a ketch, a fort, the Mortar perk or the Bomb Ketch's mortar side |
| `whistle` | a shell on screen with under 700ms to fall, once per shell |
| `hit` / `hurt` | a new `hit` effect away from / at the player's ship |
| `splash` | a new `splash` effect |
| `blast` | a new `blast` effect (shell, fireship, razed fort) |
| `aground` | the player's `agroundMs` went up (replaces `hurt` that frame) |
| `sink` + `gurgle` | a new `sink` effect (sunk, rammed or scuttled) |
| `ui('coin')` | a new `coins` effect (loot hauled, cargo, fort bounty, prizes sold) |
| `prize` | a new `prize` effect (boarding) |
| `bounty` | the harbor opens with `bountyPaid` |
| `escape` | a new `escape` effect, or the convoy turning `lost` |
| `bell` | the convoy turning `arrived` |
| `pipe` | an enemy id not seen before (a sail on the horizon), once a frame |
| `creak` | the helm put over from 0 while sailing |

`GameScene` plays the shared `ui` sounds for its buttons: `harborAction` plays `coin` for a
purchase (upgrade, repair, hire, keep), `click` for a choice (perk, loading, sail) and `refuse`
when the sim function returns false; the end card's ship buttons and boon rows `click` or
`refuse`, "Sail again" and "Sail on" `click`, and the scuttle button `refuse`s if it fails (the
scuttle itself sounds through its `sink` and `coins` effects). To add a sound: an entry in `sfx`,
then a check in `SoundCues.after` (or a case in `effects` for a new effect kind).

## Testing hooks

- `src/main.ts` puts `game` on `window` in dev builds. State positions are always inside `WORLD`;
  the scene's drawn positions are not (see "Wrapping sea"). The test reads
  `game.scene.getScene('Game').state` (deep-copied through JSON) and `.harbor.buttons`.
- `e2e/playthrough.spec.ts` seeds `Math.random` and drives 64ms frames. It presses the mouse down
  on the helm wheel centres to steer: first to check a turn each way and that the ship holds its
  heading with the helm released, and it checks the first order is `chain`. Then it closes on a
  sloop to within `CLOSE_IN` and turns side-on until a sloop is within `FIRE_WITHIN` and `AIM_ARC`
  of straight out from one side. It holds that side's `FIRE` control, checks `aim` and a growing
  `charge` with no player shot in flight (screenshot `0-aim`), lets go once the charge reaches the
  sloop (`chargeNeeded`), and checks that the charge is null, the side reloads and two `chain`
  balls flew (`1-broadside`), then that the first sloop hit has `slowMs > 0`. It fights on the
  same way (`fight`: hold a loaded side's fire control while a sloop is off it, let go when
  charged enough or the sloop leaves the arc, otherwise steer) until both sloops are sunk, checks
  that the first leaves loot (afloat or already sailed over, `2-loot`) and that the harbor opens
  with both sloops' gold aboard and the prize draft `FIRST_DRAFT` on offer (`3-draft`), taps the
  first card and checks that `perks` holds it, `draft` is empty and the gold is untouched
  (`4-harbor`), then taps the `shot` row, taps `load-starboard` and checks that side is loaded
  with chain shot at no cost (`5-loadout`), and taps `sail`. At the start it also checks the
  wave's `wind` is `FIRST_WIND`, the `loadout` is round shot on both sides, the `hull` is
  `FIRST_HULL`, `perks` is empty and `bounty` is null.
- Keep in sync with the test: `HELM` and `FIRE` centres (copied into the test), `VIEW`, wave 1
  being `['sloop', 'sloop']`, `FIRST_ORDER` (`chain`) and chain shot's look (`shot: 'chain'`),
  sloop loot 10 (plus the per-wave bonus, which is 0 on wave 1), the Frigate's hull of 120, two
  guns a side, its `range` (260) with `REACH_MIN` (0.65), `ARC` (the test uses 28 degrees, inside
  32), Heavy Shot's first cost of 15, `CLOSE_IN` (220) staying under the range, `FIRST_HULL`
  (`frigate`), `FIRST_DRAFT` (`['salvage', 'ricochet', 'mortar']`, copied into the test, which
  taps the first card), and `WORLD` (copied into the test, which measures bearings and distances
  the shortest way round). The test also relies on: the `break` phase allowing steering, the
  first enemy appearing within 5s, `GameState` field names, harbor button ids matching
  `UpgradeId` / `'sail'` / `load-<side>` / `draft-<perk>` (the harbor after wave 1 offers no
  course, so its button is still `sail`), the draft's cards being the only
  buttons listed while it is on offer, `bestWave` becoming 1 on reaching the harbor, wave 1
  posting no bounty, wave 2 having more ships than wave 1, and `broadside-trophies` holding exactly
  `firstSink` once wave 2 is under way (a trophy a first round can reach in another way changes
  that expectation). Also `FIRST_WIND` (0, copied into
  the test), both sides starting loaded with round shot, the chain order overriding the loadout,
  and `nextShot` going from round to chain.

## Making common changes

- **Add an upgrade:** add an id to `UpgradeId` and an entry to `UPGRADES` in `upgrades.ts`, then
  apply it in `stats()` in `state.ts`. The harbor adds a row automatically, but `HARBOR` in
  `layout.ts` only fits eight rows (five upgrades, repair, hire, keep) plus the loading buttons
  and the sail buttons, so adjust `h`, `firstRowY`, `rowGap` or `loadY`.
- **Add a perk:** add an id to `PerkId` and an entry to `PERKS` in `perks.ts` (with `desc2` for its
  second rank), then its rule in `sim.ts` (or `stats()`) behind `hasPerk(s, id)`, with its number
  an array by rank read through `perkValue`. The draft offers it on its own; keep the name
  and description short enough for a `DRAFT` card.
- **Add a course:** add an id to `CourseId` and an entry to `COURSES` in `courses.ts`, apply it in
  `waveShips` (or `lootOf`/`reachHarbor` in `sim.ts`), and widen `COURSE` in `layout.ts` (it fits
  two buttons side by side).
- **Add a bounty:** add an id to `BountyId` and an entry to `BOUNTIES` in `bounties.ts` with
  `met` reading the wave's trackers (add one to `GameState`, reset in `setSail`, if none fits)
  and `offered` if only some waves can post it. Nothing on wave 1: the playthrough expects the
  first harbor's gold untouched.
- **Add a ship for the player:** add an id to `HullId` and an entry to `HULLS` in `hulls.ts`
  (with its `crew` and `unlockWave`) and a look in `SHIP_LOOKS` in `art/art.ts` (its texture
  `ship-<hull>` is baked automatically). The end card's row of ships adds a button on its own;
  `OVER.shipW` fits three.
- **Add a captain's order:** add an id to `OrderId` and an entry to `ORDERS` in `orders.ts`. Stat
  multipliers (`damage`, `range`, `reload`, `sails`) apply through `stats()`; anything else needs
  rules in `sim.ts`. Draw its emblem in `bakeSeal` in `art/art.ts` (the texture `seal-<id>` is
  baked for every id). A new shot look needs a `Ball['shot']` value and a `shot-<look>` texture
  in `bakeShot`. Keep the title and description short enough for the card (about 300px).
- **Add an enemy ship:** add a kind to `EnemyKind` and `ENEMIES` in `ships.ts` (with its `crew`,
  and `grape` if it loads grapeshot up close), a look in `SHIP_LOOKS` in `art/art.ts` (its
  texture is baked automatically), and place it in `waveShips`. A ship that fights other than by
  broadsides gets a `role` handled in `captain` (how it sails) and `enemyBroadsides` /
  `escortBroadsides` (how it attacks).
- **Add a kind of shot:** add it to `ShotKind` and `SHOTS` in `shot.ts`, its effect on a hit in
  `moveBalls`, and a `shot-<kind>` texture in `bakeShot`. The harbor's buttons cycle through
  `SHOT_IDS` on their own.
- **Add an Admiralty reward:** add it to `BoonId` and `BOONS` in `admiralty.ts` and apply it in
  `newRun`. The game-over panel adds a row on its own, but `OVER` fits five rows; adjust
  `firstRowY`, `rowGap` or `h` for more.
- **Rebalance:** edit the tables listed above. If a wave 1 number changes (sloop stats, the
  Frigate's stats, charge numbers, the first order, the first draft, Heavy Shot cost), update the
  constants at the top of the playthrough test in the same PR.
- **Change controls or the HUD:** the helm wheels and fire controls are built in `createControls`
  and drawn in `drawControls`, input is read in `readInput` (all in `GameScene.ts`), and their
  positions are `HELM` and `FIRE` in `layout.ts`. Update the test's `HELM` and `FIRE` copies
  whenever they move, keep the fire controls clear of the wheels for two-thumb play, and keep the
  port wheel clear of the shared corner buttons (bottom left, about 12-114 by 12-42 CSS pixels).
- **Move or add an island:** edit `ISLANDS` in `state.ts`; the chart repaints it at boot and the
  steering and collision follow. Keep islands far enough apart that one detour doesn't lead onto
  another.
- **Add or change a text:** add its key to `i18n/en.ts` (British spelling), its German to
  `i18n/de.ts` (or the key to `keepEnglish` if it is the same) and, if US English spells it
  differently, to `i18n/en-US.ts`, then show it with `t(key, vars)`. Run
  `node scripts/check-translations.mjs`. Check German fits: it runs longer, and the end card's ship
  buttons, the draft cards and the order card have the least room.
- **New visual effect:** add a kind to `Effect['kind']`, emit it with `effect()` in `sim.ts`, and
  draw it in `GameScene.drawEffects`.

## Gotchas

- The harbor dims rows that cannot be afforded, but every row stays clickable. `buy` and `repair`
  enforce the rules and quietly return false.
- `ENEMIES[e.kind as keyof typeof ENEMIES]` casts appear throughout `sim.ts`. Never pass the player
  ship to code that looks up `ENEMIES` (`speedOf`, `fend`, `shoalAhead`, `captain` included).
  Prizes are enemy kinds, so they can go through it. The player's own numbers come from
  `HULLS[s.hull]` through `stats()`; `SHIP_LOOKS` is keyed by hull or enemy kind, so the scene
  goes through `lookOf(ship, s.hull)`.
- `s.escorts` holds prizes, consorts and the convoy alike: tell the convoy by `s.convoy?.id` (she is
  never sold, scuttled or kept, and `sailEscort` hands her to `sailConvoy`) and a consort by
  `kept`. A merchantman prize has no guns, so she keeps station and `escortBroadsides` skips her.
- Every loop over all ships must include `s.escorts` as well as `s.player` and `s.enemies`
  (timers, separation, running aground, blasts, wakes). A ship moves between `enemies` and
  `escorts` on capture, so take it out of the list before pushing it to the other. Forts are not
  ships: they have their own list, hit test (`FORT.radius`) and bar, and only `blast` and
  `moveBalls` hurt them.
- Take hull off a ship with `hurt` and sailors with `kill`, never with a bare `hp -=`, so the
  bounty's damage count and the crew's floor stay right. `newShip` needs the radius and crew.
- The draft blocks the ledger: while `s.draft` is not empty the harbor's `buttons` are the cards
  only and `setSail` does nothing. A perk with no entry left to draw leaves `draft` empty, so a
  late-run harbor opens straight on the ledger.
- When aiming at the player, enemies lead using `stats(s).speed` times `windSpeed`. The player's
  own broadside leads using `speedOf(s, target)` (wind, chain shot and crippling, not shortened
  sail).
- Balls are cleared on reaching the harbor and loot is cleared by `setSail`. HP, reload timers and
  position carry over between waves.
- Everything that is fixed on screen must be scroll factor 0, and containers need `pinToScreen`,
  not a plain `setScrollFactor`. Otherwise taps land in the wrong place once the camera moves.
- Don't rotate an image inside a pinned container: in WebGL a rotated child of the order card
  drew with a torn corner, so the card's slant is painted into its texture instead.
- Never draw at a state position directly or compare positions with a plain subtraction: use
  `place` in the scene and `offset` (or `bearing` and `distance`) in the sim, or things near an
  edge show up a whole sea away. Anything new that moves must end its move with `wrapPoint`.
  `detourCourse` returns points near the ship, unwrapped; the scene shifts them by `place(e)`.
- Anything painted into the `sea` texture that can cross its edge must be painted again one sea
  over (`copies` in `bakeSea`, and `parchment(..., wrap)` for the stains), or a seam shows.
- `WORLD` must stay more than twice `VIEW` on each axis, or two copies of one thing could be on
  screen while only the nearest is drawn.
- The island names on the chart, the compass letters and the helm and fire control labels are
  painted into textures at boot, so they take the language the page loaded with; the rest is
  translated each time it is drawn.
- `drawPointers` draws into the same `hud` Graphics as the hull bar, so it must run after
  `hud.clear()` in `drawHud`.
