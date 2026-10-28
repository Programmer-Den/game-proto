# Riftblade: guide for agents

How this game is built and where it stands, for agents about to change it. `README.md` covers how
to play and the upgrade tables. Per the root `AGENTS.md`, keep this file up to date in the same PR
as any change to the game.

## Current state

A survivor-style auto-attack roguelike, landscape 960x540. A run is the Rift Crusade: four jumps
of five minutes each, every one ending in its boss: the Dune world, then one of Swamp, Spore and
Scrap, then one of Ice, Crystal and Storm (each picked on the space map), then the Lava world, with
a star map between them.

- Implemented: a hero select screen with twelve heroes in a 6x2 grid and a detail panel with a
  Fight button: three soldiers (Captain Rook, Legionary TR-9, Corporal Bram-17), seven blade
  knights (Kael Varro, Lord Vharn, Master Oom, Elder Corvin Hale, Regent Veyl, Kresh the
  Twinblade, Master Joren Vask) and two more Blaster heroes, Commander Elara Voss and Triad-77.
  Only TR-9 is open on a fresh save; every other hero is unlocked by a deed (`checkDeeds`), never
  shown in the game: a locked card is a dark placeholder (`rb-locked`, no art, name or colour) and
  its detail panel says only "Locked". A deed done mid-run pauses the game on the new hero's panel
  until Continue. Each hero has an auto-attacking weapon, a
  signature move (Space or the round button), three five-tier paths and a fourth, its drill (plain
  stat gains, `DRILLS`). Pools by weapon class
  and side: Blaster (10 skills: soldiers, Elara, Triad-77), Blade (8, knights), Current (6: Kael, Oom, Corvin,
  Joren) and Hollow (6: Vharn, Veyl, Kresh, and Kael once he takes The Fall); Joren may also draw
  Lightning Arc. The shared Gear deck (12 pieces), the 6-ability and 4-gear limits, level-ups with
  three cards (four for Elara, her Hope; at least one of the hero's own paths while any are left,
  the Field Ration as filler), 36 capstones and 13 crossovers (the cards show a link icon); gold-ringed elites with
  chests and credits, ring waves at 1:30, 3:00 and 4:15 on every planet; once the boss appears
  no new foes spawn but its own adds. Every gun aims at the nearest foe.
- Side objectives (`objectives.ts`): three a world, at 1:00 (one of four shared ones), 2:15 (the
  world's own) and 3:30 (the hero's own, one per hero), each timed, with a marker, an arrow at the
  screen's edge and two HUD lines under the clock; rewards are credits, a level or a free card.
  None in the arena; the boss calls one off. Power-ups (bomb, magnet, lure, overdrive, shield,
  freeze, credit cache) drop from foes after a world's first minute.
- Eight factions. The first four: Scrap bots (Clankers, Rollerbombs; the Grinder Crawler), wild beasts (mire rat
  packs, spitter toads with slowing globs; the Bog Mother with globs, young and bog pools), the
  Iron Dominion (line trooper squads firing volleys, walker gunners; the Siege Walker with volleys,
  artillery barrages behind ground warnings and stomps) and the Hollow cult (ash acolytes that
  burst into embers, fallen knights with a frontal shield and dashes; the Hollow Champion with
  marked blade dashes and, below half health, rings of fire with gaps), plus lava vents. The four
  the space map adds (`art/worlds.ts`): the Mycelid Bloom (sporelings in clumps that burst into
  slowing spore clouds, puffcaps puffing rings of spores; the Spore Queen fights like the Bog
  Mother with spores and sporelings), the Scrap Horde (scrapper packs, haulers that split into
  scrappers; the Scrap King fights like the Grinder Crawler, harder, with scrappers), the Shardborn
  (shardlings that burst into splinters, prisms firing lances; the Prism Colossus fights like the
  Siege Walker) and the Stormcallers (weaving wisps, conductors calling lightning on the hero,
  lightning strikes; the Storm Herald fights like the Hollow Champion with sparks). Each later boss
  is its own `BossId` with `mech` (whose attacks), `power` (its shots' strength) and `adds`.
- Between planets: collecting what is left, credits, the space map (the next planet, from the
  next stage's three; the Lava world last), the star map with 2-3 nodes (trader, elite
  arena, rest, event; four events), free arena picks, the escort bot. The hero, level, kit and
  allies carry over; the clock resets per planet. Victory after the Lava boss; the end screen
  names the planet reached. Saved longest run, wins, best rift heat and furthest jump per hero, the heroes
  unlocked and the planets charted (landed on), and the run under way: closed mid-run, the game
  opens on it again, where it stood.
- The field is endless: the camera follows the hero, foes spawn on a ring just past the view's
  corners (whatever the screen's shape) and ones left far behind are brought round ahead again.
- Rift heat (`heat.ts`): once a hero has won, its detail panel shows a Heat row (0 up to one
  above the best heat won with it, at most `MAX_HEAT` = 5) and the run starts at the heat picked
  (`state.heat`). Each heat keeps the rules below it and adds one (`HEAT_AT`): 1 elites twice as
  often (`director`), 2 hits on the hero a quarter harder (`hurtHero`), 3 no rest node
  (`rollNodes`), 4 a boss's frenzy below a quarter health (`Enemy.phase3`, `bossAttacks`: its shot
  and add timers run `HEAT.frenzy` times as fast, the enraged speed `frenzySpeed` times), 5 foes
  and bosses a quarter more health (`spawnAt`, not structures). A win records the heat in
  `progress.heat`, opening the next. The HUD's planet tag and the end screen name the heat.
- The Armoury (`armoury.ts`): a run's end banks its unspent credits plus `SALVAGE_PER_WORLD` per
  world reached (`salvage`, into `progress.bank`, shown on the end screen); once anything is banked
  the hero select shows an Armoury button (top left) that opens `armouryPanel` over it
  (`GameScene.armouryOpen`). Five pieces (`ARMOURY`, ranks priced by `prices`): Field Rations
  (`maxHpMod`), War Chest (starting credits), Lumen Lens (pickup radius in `statsOf`), Field
  Briefing (a fourth card at the first level-up, `state.briefed` in `nextPick`, at most four) and
  Spare Reroll (`state.freeReroll`, set when a trader opens, `rerollPrice`). `startRun` copies the
  ranks into `state.perks` and applies them.
- The weekly run (`weekly.ts`): once a run has ended (`progress.bestMs`), the hero select shows a
  Weekly run button (top right) that opens `weeklyPanel` (`GameScene.weeklyOpen`). `weekOf(now)`
  numbers the week (Mondays 00:00 UTC from 2024), `weeklyOf(week, open heroes)` picks its hero and
  two of six `MUTATORS` with its own generator. The run (`state.week`, `state.mutators`) is fought
  at heat 0 without the Armoury. Every rules draw goes through `rand()` (`weekly.ts`), which is
  `Math.random()` in a normal run and the weekly's own seeded generator while one is on; the global
  `Math.random` is never replaced, so Phaser's texture ids and the shared sound's draws never shift
  a weekly's sequence. `reseed` seeds `rand` at the start, on the space map's choice
  (`chooseWorld`), at each new planet (`nextPlanet`) and on resume (from `state.rng`, the
  generator's position `rngAt()` that `GameScene.saveRun` stores, so a run picked up mid-fight
  draws on as it would have; older saves without it reseed from the stage), and `unseed` puts
  `rand` back on `Math.random` at the run's end, Run again and any other run's start. Mutator
  effects (`MUT`): Glass Cannon and Overcharged in `statsOf` and `startRun`, Swarm in `director`
  and `spawnAt`, Haste in `statsOf` and `spawnAt`, Vampire in `kill` (and no regen), Fragile Foes
  in `spawnAt` (bosses too) and `hurtHero`. `recordWeekly` keeps the week's furthest jump and win in
  `progress.weekly`; the first win of a week banks `WEEKLY_BONUS`.
- Trophies (`src/trophies/`, see `shared/trophies.ts`): ten, listed with `trophySet` in
  `trophies/index.ts` (handed to `setupGame`), texts in `trophies/i18n/`. `trophies/check.ts`'s
  `checkTrophies(state, progress)` runs every frame from `GameScene.update` and awards each one whose
  condition holds (the first call of a page quietly): `firstBoss` (a stage past the Dune world or a
  boss down, or a saved furthest jump of 2), `capstone` (one in the run), `newHero` (two heroes
  open), `firstPiece` (any Armoury rank), `crusade` (any win), `weekly` (`progress.weekly.won`),
  `heat3` and `heat5` (best heat won), `armouryFull` (every rank bought) and `allHeroes` (all twelve
  open, hidden). The playthrough's first minute earns none.
- Sound effects and music (see Sound below).
- Not built yet: Watch AI.
- No TODOs or FIXMEs in the code.

## Architecture

### File map

- `src/main.ts`: creates the `Phaser.Game` (960x540, `Scale.FIT`) with `BootScene` then
  `GameScene`, calls `setupGame(game, { howToPlay, trophies })` and `setupScaling(game, { fill: true })` (the
  view takes the screen's shape, 960x540 at the smallest, see Layout below), and puts `game` on
  `window` in dev builds.
- `src/howToPlay.ts`: the How to play text in British English (which US English shares) and
  German, picked with `byLanguage`; update both when controls or the first round change.
- `src/i18n.ts` and `src/i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British
  English source, `i18n/de.ts` the German (with `keepEnglish` for the few texts that are the same)
  and `i18n/en-US.ts` the texts spelled differently in US English ("Plate Armor", "armored").
  `t(key, vars)` shows a text in the hub's language; `TextKey` types the keys. Every name and text
  in `heroes.ts`, `upgrades.ts`, `planets.ts` and the events is a `TextKey`, and every text on screen goes through `t` (in `sim.ts`, `blades.ts` and `squad.ts` it
  is imported as `tr`, since `t` is a common local name there). Floating texts are translated when
  they pop.
- `src/trophies/index.ts` (`trophies`, imports nothing from the game so the hub can load it),
  `src/trophies/check.ts` (`checkTrophies`, `EARNED`) and `src/trophies/i18n/` (`en.ts`, `de.ts`,
  `en-US.ts` for Armory).
- `src/game/heroes.ts`: `HeroId`, `HERO_IDS` (select order), `PoolId`, `HEROES` (weapon numbers,
  aim mode, `pools`, `extra` pool skills, signature, paths, blurb, `short` name for the Fight
  button, the `pathKind` line of their path cards, `r`, `armour` and `locked`)
  and each hero's `schemes` (`HeroScheme`: `name`, `body`, `accent`, optional `mark`, `bolt`);
  `schemeOf(id, variant)` returns a scheme (Kael has a second, Fallen, used once he takes The
  Fall), `isKnight`. All hero colours come from here; each hero's accent is unique (Elara's red,
  Triad-77's white), except Kael's Fallen scheme, which takes Lord Vharn's colours. `locked` marks a hero that needs a deed (all but TR-9); Triad-77's `maxHp`
  is the sum of its three bots' and its `r` the whole unit's.
- `src/game/upgrades.ts`: `UPGRADES` (every path, pool skill and gear piece, with five tier lines),
  `MAX_TIER`, `MAX_ABILITIES`, `MAX_GEAR`, `FILLER`, `CAPSTONES`, `CROSSOVERS`, `capstonesOf`,
  `crossoversOf`, `crossoverFor(id, hero)` and `capstoneFor` (card hints), `at` (per-tier tables),
  `DRILLS` (each hero's fourth path: an id, name and five `DrillStep`s, made into `UPGRADES` rows by
  `drillDefs`; `DRILL_STEPS` holds each step's numbers, summed by `drillMods` in `statsOf`),
  `POOL_NAMES` (the pools' card kind lines), `poolsOf` (the pools a hero draws from now), `canOffer`,
  `rollChoices` and `cardCount` (4 for Elara, else 3). Pool skills carry `pool`; a hero is only offered skills of `poolsOf` or its
  `extra`.
- `src/game/planets.ts`: `PlanetId`, `PLANETS` (per planet: `stage` (its jump, 0 to 3), name, faction, `foes` (the HUD's kill count, with
  plural forms), `elite` (its pop), `hp` / `spawn` / `dmg`
  multipliers, ring-wave kind, elite kinds, boss, ground colours, `hint` (the space map's line)),
  `LAST_STAGE`, `STAGES`, `planetsAt(stage)`, `BOSSES` (name, boss bar label,
  `beaten` line for the end screen, size, health, credits, `mech`, `power`, `adds`), the bosses' attack numbers (`BOG`, `SIEGE`, `CHAMPION`), `VENT`, `STRIKE` (the Storm world's lightning and conductors), `CREDITS`, `ARENA_MS`,
  `arenaElites`, `TRADE` (prices), `NODE_INFO` (star map nodes), `REST_HEAL`, `planetLabel(stage, planet)`.
  The first four planets keep their indices 0 to 3 (Dune, Swamp, Ice, Lava); the later ones follow
  (4 Spore, 5 Scrap, 6 Crystal, 7 Storm), so tables by planet index (`WORLD_OBJECTIVES`,
  `PLANET_SONGS`) list them in that order.
- `src/game/heat.ts`: rift heat: `MAX_HEAT`, `HEAT` (the rules' numbers), `HEAT_AT` (the heat
  each rule comes in at), `HEAT_RULES` (each heat's text key), `hot(heat, rule)` and `heatOpen(best)`
  (the highest heat open to a hero).
- `src/game/armoury.ts`: the Armoury: `ArmouryId`, `ARMOURY` (name, text, rank prices),
  `ARMOURY_IDS`, `PERK` (each rank's numbers), `salvage` and `SALVAGE_PER_WORLD`, `perkAmount` (a
  card's `{n}`) and `nextPrice`. Imports nothing from the game but types.
- `src/game/weekly.ts`: the weekly run: `MutatorId`, `MUTATORS`, `MUTATOR_IDS`, `MUT`,
  `WEEKLY_BONUS`, `weekOf`, `weekSeed`, `seeded` (mulberry32), `weeklyOf`, `rand` (the rules' random number), `reseed`, `unseed`
  and `rngAt`.
  Imports nothing from the game but types.
- `src/game/state.ts`: `GameState` and its parts (`Hero`, `Enemy`, `Bullet`, `Shard`, `Blast`,
  `Bomb`, `Fire`, `Ally`, `Pickup`, `Hazard`, `Pop`, `EventState`), the balance numbers (`RUN_MS`,
  `MAX_ENEMIES`, `MAX_SHARDS`, `ENEMY` for every foe kind, `ELITE`, `ROLLER`, `RATS`, `TOAD`,
  `LINE`, `WALKER`, `EMBER`, `KNIGHT`, `SPORE`, `SCRAP`, `SHARD`, `WISP`, `BOSS`, `WAVES`, `SPAWN_RING`, `LEASH`, `PICKUP_R`, `HERO_R`),
  `POWER` and `POWER_UPS` (power-up drop chance, weights and effects), the objective types
  (`Objective`, `ObjectiveId`, `SHARED_OBJECTIVES`, `WORLD_OBJECTIVES`, `HERO_OBJECTIVES`,
  `OBJECTIVE_AT`, `StructureKind`), `DIFF` (difficulty), `freshState`, `xpFor` (5 + 2·level +
  level²/3: a little quicker than before for the first levels, slower from level 8 and much slower
  later), `statsOf` (the hero's numbers from upgrades and
  `maxHpMod`, with `squadMods` for Elara and Triad-77 and `drillMods` for the drills; `bossDmg`,
  `execute`, `harvest` and `creditMul` are the Threat Scanner, Executioner Rounds, Soul Harvest and
  Salvage Rig), `botCount` and `botMax` (Triad-77's
  bots and their health), `refreshUnlocks` and `clock`. `Bot` and `Flag` are Triad-77's bots
  (`state.bots`, `formation`, `scrap`) and Elara's signal flag (`state.flag`, `supplyWorld`).
- `src/game/sim.ts`: the rules of a fight. `startRun`, `choose` / `nextPick` (free picks first,
  then level-ups, then `state.after`), `raise` / `lower` (a tier up or down), `tick` (splits a frame
  into steps of at most 16 ms), and per step: the foe grid (`near`, `nearest`, `swarmSpot`), the
  hero (`moveHero` with slows, `hurtHero` with `HURT_GRACE_MS`, `signature`), weapons (`bolt`,
  `volley`, `primary`: every gun at the nearest foe, Rook's second at the next nearest, Bram's
  heavy rounds and Brothers), every upgrade (`abilities`, `syncAllies`, `moveAllies` with the escort),
  foes (`director` with `spawnRate` and `spawnGroup` per faction and `spawnElite`, all stopped
  for good once the boss is up, so only the foes left and the boss's own adds remain; `moveEnemies` with
  each kind's behaviour, `bossAttacks` per boss, `detonate`), hazards (`hazards`, `inRingGap`),
  damage (`damage` with the knight's guard and `BOSS.alone`, double damage to a boss with no other
  foe left, `kill`, `explode`), bolts, bombs, fire and pickups
  (`gainXp`, `openChest`, `collectAll`), power-ups (`dropPowerUp` from `kill`, `powerUp` when
  taken; Lure and Overdrive work through `statsOf`, the shield in `hurtHero`; `collectAll` drops
  any left lying) and `state.hits` (counted in `damage`). The arena ends at the end of `step`. Exports
  `suppressorLength`, `suppressorHalf`, `shieldHalf`, `phalanxSpots` and `angleDiff` for drawing,
  and `stats`, `near`, `nearest`, `swarmSpot`, `bolt`, `volley`, `ready`, `knock`, `damage`,
  `explode`, `addBomb`, `heal` and `SHORT_LIVED` (allies gone after a fight) for `blades.ts`,
  `squad.ts` and `voyage.ts`. Knight code runs only when the hero `isKnight`, squad code only for
  Elara and Triad-77, so the soldiers' `Math.random` order is unchanged. `hurtHero` takes where a hit
  came from (Triad-77's nearest bot takes it). TR-9's Drop Squad troopers (`legionary` allies)
  land with a drop pod (an `orbital` bomb) in `syncAllies`. Foes with `charmMs` (Persuasion's
  turned foes and the Diplomat's confused ones) fight other foes in `turned`.
- `src/game/blades.ts`: everything the knights do, called from `sim.ts`: `knightMods` (their
  `statsOf` numbers: reach, dodge, signature cooldown, Temper, Rage and the like), `knightAttack`
  per aim mode (`slash`, `throw` boomerang blades, `ripple`, `spin`, `chain` lightning, `orbit`,
  `flurry`), `knightSignature`, `knightAbilities` (every knight path and Blade, Current and Hollow
  skill), the knights' allies (`knightAllies`, `moveKnightAlly`: starfighters, co-pilot, spirits,
  puppets), hooks for kills, heals and hits (`onKill`, `healFactor`, `onHurt`, `rescue`,
  `knightGuard`, `foeMod`, `contactMod`), `orbitBlades`, `bladeColor` and `heroVariant` for
  drawing, and `checkDeeds` (every hero's unlock deed, into `state.deeds`; `DEEDS` holds Elara's
  and Triad-77's numbers). Slashes and lightning are
  `state.slashes` / `state.zaps`, drawn by `GameScene` (lightning jitters from a hash).
- `src/game/squad.ts`: Elara Voss and Triad-77, called from `sim.ts` like `blades.ts`:
  `squadAttack` (Elara's pistol on the nearest foe, the second pistol on the next nearest;
  `triadVolley`, each bot at the foe nearest to it in Spread (with Uplink 2 each on a different
  one), all at the unit's nearest in Column), `squadSignature` (Call for Aid: the flag and
  12 `carpet` bombs round it, Diplomat confusion; Formation Shift and Hive Signal's bursts),
  `squadAbilities` (the flag's bubble and confusion, the bike, the Uprising supply drop; bots
  walking to `botSpots` and being rebuilt), `syncSquad` (bots and health in line with the
  upgrades: the hero's health is the sum of its bots'), allies (`squadAllies`, `moveSquadAlly`:
  commandos, `bike`, `medic`, `shieldbot`, `command`, `spare`; `droneSpot` for Eyes in the Sky) and
  hooks (`squadHurt`, `hurtFactor`, `squadHeal`, `squadCrit`, `turnedBonus`, `squadKill`,
  `squadBlock`, `bubble`, `rebuildTime`). `AID`, `BUBBLE` and `TRIAD` hold their numbers.
- `src/game/objectives.ts`: the side objectives, called from `sim.ts` once a step like `squad.ts`
  (it imports `sim.ts`, so the same rule about load-time values holds): `OBJ` (each one's time
  limit, goal, zone radius and reward), `OBJ_MISC` (pushes, escort and pilgrim, nests, vents, the
  zone's end size, stand times, the wreck, thawed troopers), `objectives` (starts one when
  `objectiveAt` comes, runs it, ends it), `pick` (shared from `sharedSeen`, then
  `WORLD_OBJECTIVES[planet]`, then `HERO_OBJECTIVES[hero]`), `start` (puts out its marker, spots,
  ward or structures), `run` per id, `finish` (reward: credits, `gainXp` to the next level, or a
  `rewardPicks` card) and `cancelObjective` (the boss). `objectiveName` / `objectiveHint` give its
  text keys (`obj_<id>`, `obj_<id>_hint`, the hint with `{n}` = the goal). Structures (`beacon`,
  `nest`, `cache`, `monolith`: `StructureKind`, `isStructure`) are foes that `moveEnemies` pins
  in place (`aimX`/`aimY`), `knock` skips and `kill` breaks without a kill, shard or drop;
  frozen troopers thawed become `thawed` allies (40 s, short-lived).
- `src/game/voyage.ts`: between fights. `frame` (tick, then `afterClear` and `nextPlanet` for the
  passing phases), `afterClear` (collect, credits, arena reward, the space map or victory),
  `chartOptions` and `chooseWorld` (the space map: sets `state.next` and rolls the nodes), `rollNodes`,
  `chooseNode`, the trader (`priceOf`, `buy`, `reroll`, `leave`), the arena (`startArena`),
  events (`rollEvent`, `chooseEvent`) and `nextPlanet` (to `state.next`, `stage` + 1, onto
  `state.route`).
- `src/game/save.ts`: `SAVE_KEY`, `loadProgress`, `saveProgress`, `recordRun`, `recordCharted`, `recordUnlocks`,
  `buyArmoury`, `recordWeekly`, `isUnlocked` ((TR-9, a deed done, a hero the save shows as played, or the old world deeds) and
  `unlockedHeroes`; the run under way: `RUN_KEY`, `isResumable`, `saveRun`, `loadRun` and
  `clearRun`.
- `src/audio/music.ts`: the songs (`PLANET_SONGS`, `MENU_SONG`, `STINGS`); `src/audio/sfx.ts`: the
  sound table `sfx`; `src/audio/cues.ts`: `SoundCues`, which plays them by watching the state (see
  Sound).
- `src/art/glow.ts`: `C` (palette), `hex`, `shade`, `paint` (a canvas texture at `sharpRes`),
  `glow`, `shape`, `beam`, `outline`.
- `src/art/factions.ts`: `bakeFactions` paints the later factions (`rb-mirerat`, `rb-toad`,
  `rb-linetrooper`, `rb-walker`, `rb-acolyte`, `rb-knight`, each with `-elite`), the bosses
  (`rb-boss-bogmother`, `rb-boss-siege`, `rb-boss-champion`, `-burning`), hostile bolts
  (`rb-bolt-glob`, `-volley`, `-slug`), `rb-escort` and `rb-credits`. Faction colours are `C.beast`
  / `C.toad`, `C.iron` / `C.ironLight`, `C.hollow` / `C.ember` in `glow.ts`, apart from the heroes'.
- `src/art/worlds.ts`: `bakeWorlds` paints the four later planets' foes (`rb-sporeling`,
  `rb-puffcap`, `rb-scrapper`, `rb-hauler`, `rb-shardling`, `rb-prism`, `rb-wisp`, `rb-conductor`,
  each with `-elite`), bosses (`rb-boss-sporequeen`, `-scrapking`, `-colossus`, `-stormherald`) and
  bolts (`rb-bolt-spore`, `rb-bolt-splinter`). `GameScene.draw` calls it the first time a run gets
  past the Dune world (the space map or another planet), not at boot (see Gotchas).
- `src/art/sprites.ts`: `bakeSprites` paints the first textures (keys start `rb-`): the heroes
  (`heroKey`, `portraitKey`, drawn by `drawHero` from the scheme), `rb-trooper`, `rb-brother`,
  `rb-legionary` (TR-9's Drop Squad troopers), `rb-commando`, `rb-medic` (Elara's rebels, drawn by
  `rebel` in `squad.ts`), the bots (`rb-clanker`, `rb-clanker-elite`, `rb-roller`, `-armed`,
  `-elite`, `rb-boss`), bolts (`rb-bolt-<HeroId>`, `-drone`, `-heavy`, `-rocket`, `-shell`),
  shards, `rb-medkit` (a green cross), `rb-chest`, `rb-drone`, `rb-charge`, `rb-grenade`, `rb-crate`, `rb-shadow`.
  Every scheme is baked: `heroKey(id, variant)` is `rb-hero-<id>` or `rb-hero-<id>-<variant>`.
- `src/art/squad.ts`: `drawSquadHero` (Elara and the Triad-77 portrait; `drawHero` hands them to
  it), `bot`, `rebel` and `bakeSquad`: `rb-bot`, `rb-bot-down`, `rb-bike`, `rb-shieldbot`,
  `rb-command`, `rb-pod` (TR-9's drop pod) and `rb-locked` (the locked hero placeholder).
- `src/art/knights.ts`: `drawKnight` (the knights, from their scheme; `drawHero` hands knights to
  it) and `bakeKnights`: the blades (`bladeKey`, `rb-blade-<id>`), `rb-fighter`, `rb-copilot`,
  `rb-spirit`, `rb-puppet`, `rb-wreck`, `rb-ship` and `rb-bolt-fallen`.
- `src/scenes/layout.ts`: `VIEW` (the designed 960x540), `SCREEN` (the real view), `FRAME` (where
  the designed rectangle sits in it), `fitLayout`, `CENTER`, HUD places (`XP_BAR`, `HP_BAR`, `KIT`, `TIMER`,
  `LEVEL`, `PLANET_TAG`, `CREDITS_TAG`, `BOSS_BAR`, `OBJECTIVE_HUD`, `SIG_BUTTON`, `STICK`), card rectangles
  (`heroCardRect` for the 6x2 grid, `HEAT_ROW`, `HEAT_DOWN` and `HEAT_UP` for the Heat row, `ARMOURY_BUTTON`, `armouryCardRect` and
  `BACK` for the Armoury, `WEEKLY_BUTTON`, `MUTATOR_CARD`, `WEEKLY_START` and `WEEKLY_BACK` for the weekly run, `levelCardRect` with `LEVEL_CARD4` for four cards, `UNLOCK` and
  `CONTINUE` for the new hero panel, `CHART`, `chartSpot` / `chartRect` (the space map), `mapNodeRect` / `mapNodeSpot`, `tradeCardRect`, `REROLL`,
  `LEAVE`, `eventOptionRect`, `AGAIN`), `DEPTH`, `inside`.
- `src/scenes/objectiveArt.ts`: the objectives and power-ups, drawn in code on the graphics
  layers (no baked textures, so boot's Math.random draws are unchanged): `drawObjectiveGround`
  (zones, spots, the escort's goal, the pilgrim, the duel's mark), `drawStructure`, `drawPowerUp`
  (`POWER_COLORS`), `objectiveTarget` (where the HUD arrow points) and `OBJ_COLOR` (cyan).
- `src/scenes/GameScene.ts`: owns `state`, reads input, runs `frame`, follows the hero with the
  camera and draws: the planet's ground (`drawGround` with `duneCell`, `swampCell`, `iceCell`,
  `lavaCell`, `sporeCell`, `scrapCell`, `crystalCell`, `stormCell`, scenery from a hash, so the rules' `Math.random` is untouched), graphics layers under
  and over the sprites (hazards, warnings, knight shields, dash lines, rings of fire), image pools
  per layer (bolts and foes drawn with additive blending; structures are skipped there and drawn
  by `objectiveArt.ts`; the wreck, escort bot and frozen troopers use pool images), floating texts
  and the HUD (planet tag, credits, running power-ups beside the health line, and
  `drawObjectiveHud`: the objective's lines at `OBJECTIVE_HUD` and the edge arrow). `splitHudCamera` keeps the HUD fixed. The panel is rebuilt whenever `panelKey`
  changes.
- `src/ui/panels.ts`: `Panel` (HUD objects plus tappable `spots`) and the builders, each filling a
  `Panel` it is handed: `heroSelect` (12 cards from
  `heroCardRect`, keyed by `heroKeyLabel`, and the detail panel `HERO_DETAIL` with the `FIGHT`
  button, and the Heat row (`heatRow`) once the hero has won, the detail lines shrinking to end
  above it; a locked hero shows only `rb-locked`), `armouryPanel` (the Armoury, see Current state), `weeklyPanel` (the weekly run), `unlockPanel` (the new hero, with a `continue`
  spot), `levelUp` (also the arena's and an objective's reward, titled by `state.after`; three or four cards whose lines flow down; pool labels
  from `POOL_NAMES`, `linkIcon` for crossovers), `spaceMap` (the four jumps as columns, lanes, the
  route lit, the next jump's planets as cards with spot ids = `PlanetId`; a faction shows once
  `progress.charted` has it), `starMap` (on the way to `state.next`), `trader`, `eventPanel`, `endScreen`.

### Layout on every screen shape

The game fills the screen (`setupScaling(game, { fill: true })`): the view is 960x540 grown to the
screen's shape, from 960x720 (4:3) to 1296x540 (2.4:1). `GameScene.create` calls
`fitLayout(viewSize, viewFrame)` once, before the HUD is made: it sets `SCREEN` and `FRAME`, puts
`CENTER` (the hero) in the middle of the view, stretches `XP_BAR` across the top, keeps `TIMER`
and `BOSS_BAR` centred, pins `LEVEL`, `PLANET_TAG` and `CREDITS_TAG` to the right edge and
`SIG_BUTTON` to the bottom right corner (`HP_BAR` and `KIT` stay top left). The ground and the
sound cues' "on screen" test use `SCREEN`, so the endless field just shows more of itself.
`begin` hands `startRun` how much further the view's corners reach than 960x540's
(`state.ringOut`, half the difference of the diagonals), and `ringPoint` moves the spawn ring out
by it, so foes never appear inside a wide or tall view; at 960x540 it is 0 and the ring, and so
the playthrough, is unchanged. Panels are still laid out in designed 960x540
coordinates (`VIEW` and the card rectangles); `syncPanel` then calls `Panel.place(FRAME.x,
FRAME.y)`, which moves every object and spot into the frame, except the backdrop (`dim` and
`stars`, marked with `Panel.fixed`), which covers the whole `SCREEN`. `hover` takes the offset
off. At exactly 960x540 the frame is at 0,0 and nothing moves.

### Flow

`state.phase` is `select` (hero cards), `run`, `levelup` (sim stopped, cards shown), `chart`
(the space map), `map`, `trader`, `event`, `won` or `lost` (end screen); `cleared` and `travel`
last only until the end of the frame. The sim runs only in `run`. `state.planet` is the planet
(an index into `PLANETS`), `state.stage` the jump (0 to 3, what the HUD's "2/4", deeds, the arena
and the save count), `state.route` the planets landed on and `state.next` the one chosen. A boss's
death sets `cleared`; `afterClear` collects what is lying about, pays credits and either wins (the
last stage's boss) or opens the space map, showing any level-ups first (`after` = `chart`).
`chooseWorld` sets `next` and rolls the star map's nodes (`map`). A node opens the trader or an event, starts the arena (`run`
with `arena` set, ended in `step` by the last elite falling or 60 s, then `cleared` again with a
free pick if won) or rests; each ends in `travel`, which `nextPlanet` turns into the chosen planet's
`run` (clock reset, field cleared, the escort bot added if taken). `frame` does that at the next
update, and `GameScene.settle` right after a panel choice or Leave, so no save lands in between
(`travel` is not saved) with a reward already taken. Run again resets to a fresh
`select` state.

The run under way is saved (`saveRun`) in every phase but `select`, `won` and `lost`: when it
starts, every time a panel opens or closes (`syncPanel`), every 5 s of run time in a fight
(`RUN_SAVE_MS`) and when the page is hidden or closed. The end screen clears it. `create` loads it
(`loadRun`) and `GameScene.resume` picks it up: the state as saved, `ringOut` worked out again for
the screen's shape, `prepare` (the sim's stats and hero flags, so a rest or ration on the panel
heals the right hero), `savedDeeds` at the deeds already done and `SoundCues.resume`, so nothing
plays for getting there (a boss alive in the save counts as already heard). If the panels throw on
the saved run, `create` drops it (`clearRun`) and opens the hero select; `syncPanel` keeps each
`Panel` in `GameScene.panel` before its builder fills it, so a half-built one is destroyed too. The shared start screen
holds it paused until Start. A hero panel waiting to be shown is not saved (its hero is already
unlocked).

### Input

Keys WASD / arrows walk; a mouse held on the field walks toward
`cameras.main.getWorldPoint(pointer)` (full speed from 40 px out). A touch on the field (`pointer.wasTouch`)
instead opens the floating stick, `GameScene.stick`: its base sits where the finger went down, the
knob follows that pointer id (`dragStick`, dragging the base along past the rim) and `moveInput`
walks the way of knob minus base, full speed at `STICK.r`, nothing inside `STICK.dead`; `drawHud`
draws it. A second touch pointer (`addPointer(1)`) lets the other thumb tap the signature. A pointerdown inside
`SIG_BUTTON` (or Space) queues the signature for the next frame of the sim; a press it cannot take
(during a level-up or a panel) is dropped. Panel cards are hit-tested with `viewPoint` against
`panel.spots`. On the hero select, tapping a card (or 1-9, 0, then - and = for the last two) sets
`GameScene.chosen` and tapping Fight (or Enter) starts the run, if the hero is unlocked, at the
heat `heatFor` gives (`heatPick`, else the highest open); the Heat row's arrows, Left / Right and
A / D step it. At a
level-up 1-4 pick a card (as many as there are); elsewhere 1/2/3 pick (a planet on the space
map, a node, an offer or an answer), 4 rerolls at the trader, Enter leaves the trader or runs again. While `GameScene.unlocking`
holds heroes just unlocked, `frame` is not run, the new hero panel shows, and Continue, Enter or
Space closes it.

### Save keys

The foes and Triad-77's units are called bots everywhere (texts, ids, textures such as `rb-bot`,
`state.bots`); they went by another name before, but no save key or stored id ever held it, so old
saves load unchanged.

- `riftblade-progress`: `{ bestMs, wins: { [heroId]: count }, heat: { [heroId]: best heat won 0-5 }, bank: credits, armoury: { [ArmouryId]: rank }, weekly: { week, best, won } | null, furthest: { [heroId]: jump 1-4 },
  unlocked: HeroId[], charted: PlanetId[] }`. `bestMs` is the whole run's time (`runMs`). Older saves without
  `furthest` load with `{}`, without `bank` or `armoury` with 0 and `{}` (unknown pieces dropped), without `weekly` with null, without `heat` with heat 0 for every hero with a win, without `unlocked` or `charted` with `[]`; unknown ids are dropped, and
  so are `wins` and `furthest` values that are not finite numbers.
  `charted` gets a planet the first frame a run is on it (`recordCharted` in `GameScene.update`) and
  the route at the run's end (`recordRun`). A hero with a
  `furthest` world is open (so saves from when Rook and Bram were free keep them), and the deeds
  of reaching a world (Kael, Veyl, Joren) also count from `furthest`. `GameScene` saves new
  `state.deeds` with `recordUnlocks` as they happen.
- `riftblade-trophies`: the trophies earned (`shared/trophies.ts`), each id with the time.
- `riftblade-run`: the run under way (left out of progress codes by the hub's `fileOnly`, so a
  code moves only `riftblade-progress` and the trophies; files carry it), the whole `GameState` as JSON (it is plain data; `Infinity`,
  as in `nextElite` and `objectiveAt`, is stored as the text `"Infinity"`). `loadRun` lays it over
  `freshState()` (and the hero over `freshHero()`), so fields added since take their fresh values;
  one with an unknown hero, a phase it can't resume in, an unknown planet or `next`, a `stage`
  outside the crusade, unknown `nodes`, `offers` or `choices`, a malformed `event`, or a list field of the state or
  hero (`enemies`, `bullets`, `dashHit`, ...) that is not an array is dropped (an `rng` that is not a
  generator position becomes -1). Keep
  `GameState` plain data (no Maps, Sets, class instances or shared references), or teach
  `saveRun` and `loadRun` the new kind.

### Difficulty and reduced motion

`DIFF.hp` (0.75 / 1 / 1.35) scales foe and boss health, `DIFF.spawn` (0.75 / 1 / 1.25) the spawn
rate, on every planet. With `settings.reduceMotion`, the walk bob, the rush spin, the hit swell and
the rising of floating text are off. Warnings fill steadily rather than blink. There is no camera
shake or flash.

## Sound

All sound goes through `shared/audio.ts` and is silent under browser automation. The sim has no
event list and imports no audio: `GameScene` calls `SoundCues.update(state)` after every frame,
which compares the state with the frame before and plays at most one of each sound per frame:
new bolts, slashes, zaps, bombs, blasts and hazards by id (`id >= nextId` of the frame before),
counts that went up (`kills`, `elitesKilled`, `chests`, `signatures`, `damageTaken`, `credits`,
`xp`, `capstones`, `crossovers`), `waves` and `nextElite`, a boss appearing or gone, and the phase.
A run picked up from the save calls `resume`, which counts from where it stands.
Enemy bolts, blasts and hazards play only on screen. The scene plays the input sounds itself.

**Music** (`music.ts`): one song per planet, Dune in D minor (152 BPM), Swamp in E minor swung
(150, three steps a beat, via `swing`), Ice in B minor sparse (156), Lava in C minor heavy
(160), Spore in A minor drifting (132, triangle lead), Scrap in G minor clanking (168), Crystal in
F# minor with chiming arpeggios (144, sine lead) and Storm in E minor driving (172, sawtooth
lead). Each has its own `calm` part, and `tense`, `boss` and `pad` written once in D minor and moved
into its key (`transpose`). `MENU_SONG` (90 BPM) has `select`, `map` and `shop`. `SoundCues.pickMusic`:
hero select `select`; a fight `calm`, `tense` for 25 s after a ring wave (ended by a new planet) and in the elite arena,
`boss` while a boss lives; level-up cards mid-fight `pad`, between planets `map`; star map and
events `map` (the space map too); trader `shop`; the end screen stops the music. `STINGS`: `cleared` (a boss falls or
the arena is won), `unlock` (a new hero), `win`, `lose`.

**Effects** (`sfx.ts`), and where they play:
- Hero bolts by colour (`boltSound`): `pistol` (Rook), `carbine` (TR-9), `spread` (Bram),
  `blaster` (Elara), `botShot` (Triad-77, drones), `heavy`, `rocket`, `boomerang` (a spinning
  thrown blade), `saber` (The Fall's wave).
- Knights' swings, from new `slashes` by aim mode: `saber` (Kael and other slashes), `ripple`
  (Oom), `spinHum` (Corvin), `flurry` with `ping` on every tenth (Joren); `crackle` for new `zaps`
  (Veyl); `whir` every 0.7 s while a foe is near Kresh's staff.
- Signatures (`SIGNATURE`, on `signatures` going up): `sigHorn`, `sigPulse`, `sigToss`, `sigSlam`,
  `sigForce`, `sigDash`, `sigRing`, `sigStorm`, `sigFlare`, `sigShift`. A signature asked for that
  does not go off plays `ui('refuse')`.
- New bombs: `toss` (grenade, frag), `charge`, `whistle` (crate, orbital, carpet). New blasts:
  `boom` (radius 90 and up, louder with size) or `pop`.
- Side objectives: `node` when one starts, `capstone` when one is done; `chest` for a power-up.
- `kill`, `eliteKill`, `bossHit` (the boss's hit flash), `hurt`, `dodge` (a knight's Foresight:
  `hurtMs` up to half the grace; the Barrier Emitter and a Shield power-up set the full grace and
  play `pop` for their blast), `barrier`, `heal` (health up by more than 8), `shard` (pitch rises with a combo), `chest`,
  `ui('coin')` for credits gained.
- `levelUp` (into the cards), `card` (a pick), `capstone`, `crossover`.
- `eliteHorn`, `siren` (ring wave), hazards `warn` (vent, shell, lightning strike), `stomp`, `fireRing`
  (also the Storm Herald's sparks), `glob` (bog pool, toad globs and spore puffs; a sporeling's
  cloud is silent), `enemyShot`, `enemyVolley` (volley, slug and splinter bolts), `bossStab`,
  `bossDown`.
- Between fights: `node` (space map and star map), `ui('coin')` / `ui('refuse')` (trader buy), `reroll` /
  `ui('refuse')`, `event`, `warp` (on to a new planet or the arena), `ui('click')` for the hero
  cards, Fight, Leave, Continue and Run again, `ui('refuse')` for a locked hero.

To add a sound: add it to `sfx.ts`, then play it from `SoundCues` off a state change (keep the sim
free of audio) or from the scene's input handler.

## Testing hooks

- `window.game.scene.getScene('Game').state`: the `GameState` (`objective` is the side objective
  under way, `objectivesDone` and `powerUps` count them).
- `.panel.spots`: the cards of the panel showing (moved into `FRAME` on a wider or taller view; `id` is a `HeroId`, `fight`, an upgrade id, a
  node kind, a `PlanetId` on the space map, `option-0` / `option-1`, `sold`, `reroll`, `leave`, `again` or `continue`), in game
  pixels. A locked hero card has `locked: true`; `heat-down` and `heat-up` are the Heat row's
  arrows (only once the chosen hero has won), `armoury` the Armoury button (once credits are
  banked), `weekly` the Weekly run button (once a run has ended); in the Armoury (`.armouryOpen`)
  the spots are the `ArmouryId`s and `back`, in the weekly panel (`.weeklyOpen`) `start` and
  `back`. `state.week` and `state.mutators` are the weekly run's. `.chosen` is the hero picked on the select screen
  (TR-9 at first), `.unlocking` the heroes waiting to be shown. `state.heat` is the run's heat.
- The hero is always at `CENTER` (480, 270 at 960x540: the middle of the view) on screen;
  `SIG_BUTTON` is at (890, 470) at 960x540, 70 px in from the bottom right corner.
- The Heat row and the Armoury and Weekly run buttons, like every new select-screen element, only shows once a hero has won: a Phaser
  text made at boot shifts the seeded sequence (see Gotchas), so a fresh save's select screen
  must make the same texts as before (a fresh save has no wins, nothing banked and no run ended).
- The playthrough (`e2e/playthrough.spec.ts`) checks the twelve cards (all but TR-9 locked on a
  fresh save), waits out Phaser's start-up easing on the select screen (140 frames; its first 120
  steps are cut short, so a run started during them would play differently depending on load
  time), taps Rook's locked card (no Fight button), then TR-9 and Fight, walks a circle by holding
  the mouse at a point turning once every 25 s, takes the first card at each level-up, fires Brace
  and plays to 60 s. It depends on: the hero card order, TR-9 being the open hero, his health,
  paths and Brace length, the layout above, TR-9 surviving a minute of that walk on Normal, and the
  first minute's XP reaching level 3 (`xpFor(1) + xpFor(2)` = 17; the run gets 18).
  A fresh browser has no saved run, so the playthrough starts on the hero select as before; saving
  draws no `Math.random`.
  Side objectives start at `OBJECTIVE_AT[0]` (1:00) and power-ups drop from `POWER.fromMs` (1:00),
  neither calling `rand` before then, so they leave the playthrough's minute as it was. Keep
  both at or after 1:00, or update the playthrough.

## Making common changes

- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and, when the US spelling differs (armour, colour), the US one in `i18n/en-US.ts`;
  run `node scripts/check-translations.mjs`. German runs longer: the star map's node texts (two
  lines), the card tier lines (two lines) and the signature button (its label shrinks to fit) are
  the tightest spots, so check a new text with `?lang=de`.
- **A new hero, planet or boss**: give its names and texts keys in the `i18n/` files too (a hero's
  `short` and `pathKind` (no deed text: deeds are never shown); a planet's `foes` and `elite`, a boss's `bar`
  and `beaten`).
- **A new hero colour scheme**: add it to the hero's `schemes` in `heroes.ts`; the art reads
  `schemeOf`. To use another scheme, change `schemeOf` (and bake per scheme if both are needed).
- **A new upgrade**: add it to `UPGRADES` (five tier lines, and `pool` for a pool skill),
  implement it in `statsOf` (a passive number) or `abilities` (something with a cooldown) in
  `sim.ts`, and add allies in `syncAllies`. For knights: `knightMods` and `knightAbilities` in
  `blades.ts`.
- **A new knight**: add its id to `HeroId` / `HERO_IDS`, its `HEROES` row (pools, a unique accent,
  `locked`), its texts in `i18n/` (name, short name, weapon, signature, blurb, path kind, and the
  paths' and capstones' names and tiers; no deed text, deeds are never shown), three paths in
  `UPGRADES`, its capstones, its art in `drawKnight`, its attack in `knightAttack` (or reuse an aim
  mode), its signature in `knightSignature` and its deed in `checkDeeds` (and `isUnlocked` if older
  saves should count), and the deed in the README. Then the select grid (`HERO_CARD` holds 12,
  keyed 1-9, 0, - and =) and the playthrough's card list. A Blaster hero with mechanics of its own
  goes in `squad.ts` the same way.
- **A capstone or crossover**: add to `CAPSTONES` / `CROSSOVERS`; check `s.capstones.includes(id)`
  / `s.crossovers.includes(id)` where it acts.
- **Balance**: spawn rate `spawnRate`, per planet `PLANETS[i].hp` / `spawn` / `dmg`, boss health
  and `power` in `BOSSES`, foe stats `ENEMY`, `ELITE`, `ROLLER` and the kinds' numbers, XP curve `xpFor`, credits
  `CREDITS`, prices `TRADE` and the heroes' own numbers (`HEROES`, `DRILLS`). The Dune world (planet 0) must stay as it is for the playthrough:
  rerun it; it must still survive the first minute on Normal. A headless bot that runs `frame` in
  Node (stubbing nothing but `Math.random`, picking planets on the space map at random) is the
  quickest way to test the later planets. The balance target: on Normal about two runs in three
  won over all heroes, with at most 20 points between the best and worst hero's win rate (see
  Balance below).
- **A new foe**: add a `FoeKind` (planets.ts) and `ENEMY` entry, its spawning in `spawnGroup`, its
  behaviour in `moveEnemies` (and any death effect in `kill`), its texture in `factions.ts` or
  `worlds.ts` (key `rb-<kind>` and `-elite`, picked up by `GameScene.drawRun` on its own).
- **A new side objective**: add its id to `ObjectiveId` (and to `SHARED_OBJECTIVES`,
  `WORLD_OBJECTIVES` or `HERO_OBJECTIVES`), its row in `OBJ`, its setup in `start` and its rules
  in `run` (objectives.ts), its drawing in `drawObjectiveGround` (a structure: a `StructureKind`,
  an `ENEMY` row and `drawStructure`), whether the HUD shows seconds (`timed` in
  `drawObjectiveHud`) and whether the arrow points at it (`objectiveTarget`), its texts
  `obj_<id>` and `obj_<id>_hint` in `i18n/`, and its README row.
- **A new heat rule**: add it to `HEAT_AT` (and its numbers to `HEAT`), check it with
  `hot(s.heat, rule)` where it acts, give its heat a `heatN` text (`HEAT_RULES`) and raise
  `MAX_HEAT` if it adds a level, then the README's heat table and How to play.
- **A new Armoury piece**: add it to `ArmouryId` and `ARMOURY` (prices), its numbers to `PERK`
  and `perkAmount`, apply `s.perks.<id>` where it acts (`startRun`, `statsOf` or the voyage), its
  `arm_<id>` and `arm_<id>_text` texts, and the README row. The panel lays out up to five cards.
- **A new mutator**: add it to `MutatorId` and `MUTATORS`, its numbers to `MUT`, check
  `s.mutators.includes(id)` where it acts, its `mut_<id>` and `mut_<id>_text` texts and the
  README row. Adding one changes which mutators every later week picks.
- **A new trophy**: add it to the list in `trophies/index.ts` (6 to 10 in all), its condition to
  `EARNED` in `trophies/check.ts`, its name and `<id>Text` in `trophies/i18n/`, and the README row.
- **A new power-up**: add it to `PowerUp`, `POWER_UPS` and `POWER.weights`, its effect in
  `powerUp` (sim.ts), its sign in `drawPowerUp` and `POWER_COLORS`, its `pu_<kind>` text, and the
  README row.
- **A new event**: add its id to `EventId`, its title, text and options (as `TextKey`s, with the
  texts in `i18n/`) in `rollEvent` and its effect in `chooseEvent` (voyage.ts).
- **A new planet or boss**: add a `PlanetId` and a `PLANETS` row at the end (with its `stage`; the
  space map lays each stage out as a column of up to three), a `BossId` in `BOSSES` (a `mech` to
  reuse an attack set in `bossAttacks`, or a new one) and texture `rb-boss-<id>`, its ground cell
  in `GameScene.drawGround`, its song in `PLANET_SONGS`, its world objective in
  `WORLD_OBJECTIVES`, its texts (name, faction, foes, elite, hint, the boss's name, bar and
  beaten) and its README row.

## Balance

Tuned on Normal with a headless bot: a Node script that imports `freshState`, `startRun` and the
voyage functions and calls `frame` every 16.7 ms, with `Math.random` seeded per run (seeds
`<base> + k * 7919`). It steers away from foes, bolts and live hazards, heads for objective markers
and shards, uses the signature in a crowd or against the boss, picks path cards first, then cards
it holds, then a fixed list of strong ones, picks a random planet on the space map, rests below
55% health and otherwise takes elite, trader, event; it buys the first thing it can afford. A run
counts as lost if a boss still stands 7 minutes after it appears. The script is not in the
repo; rebuild it from this description when you rebalance, and have it append each finished run
to a results file (and skip runs already there) so a restart loses little.

The current numbers were checked on a seed set they were not tuned on (base 330001, 60 runs per
hero, 720 in all):

| Hero | Won | Win rate | Fell on jump 1 / 2 / 3 / 4 |
| --- | --- | --- | --- |
| Captain Rook | 38 / 60 | 63% | 0 / 1 / 9 / 12 |
| Legionary TR-9 | 47 / 60 | 78% | 0 / 1 / 4 / 8 |
| Corporal Bram-17 | 40 / 60 | 67% | 0 / 0 / 6 / 14 |
| Kael Varro | 38 / 60 | 63% | 0 / 2 / 10 / 10 |
| Lord Vharn | 39 / 60 | 65% | 5 / 3 / 1 / 12 |
| Master Oom | 37 / 60 | 62% | 0 / 2 / 4 / 17 |
| Elder Corvin Hale | 42 / 60 | 70% | 12 / 0 / 1 / 5 |
| Regent Veyl | 37 / 60 | 62% | 0 / 0 / 0 / 23 |
| Kresh the Twinblade | 45 / 60 | 75% | 0 / 0 / 2 / 13 |
| Master Joren Vask | 43 / 60 | 72% | 0 / 0 / 2 / 15 |
| Commander Elara Voss | 48 / 60 | 80% | 6 / 1 / 3 / 2 |
| Triad-77 | 44 / 60 | 73% | 0 / 0 / 2 / 14 |
| **All** | 498 / 720 | **69.2%** | |

The spread is 18 points (62% to 80%). Most runs are lost on the Lava world; Corvin's losses come
mostly on the Dune world. Things learned while tuning:

- At 60 runs a hero's rate still wobbles by about 6 points either way, and seed sets differ, so
  judge a change on 60 or more runs and confirm on a fresh seed set; one set tuned to a 15-point
  spread showed 25 to 30 on the next.
- Health and damage in `HEROES` are the main levers; Vharn (range) and Corvin (range, and health
  for the Dune world) barely respond to damage.
- TR-9's health, damage and range stay as they are for the playthrough (its health is checked,
  and a shorter range broke its first minute), so it was nerfed through its drill, a 20 s Brace,
  a narrower Riot Shield (`shieldHalf`) and softer high-tier Suppressor burn and shield bash.
- Bram-17 swings a lot with small damage changes.

## Gotchas

- Painted textures with a glow halo darken whatever is under them in WebGL; bolts and bots use
  `BlendModes.ADD` for that reason. Don't draw filled ellipses in the shared graphics layers (they
  drew stray wedges in WebGL); the hero's shadow is a sprite.
- The objective's two HUD texts are made when the first objective starts, not in `create`: a
  Phaser text makes a texture too, and one more at boot shifted the playthrough's seeded minute.
- Phaser draws on `Math.random` for the id of every texture it makes, so baking more textures at
  boot shifts the seeded sequence the playthrough's run starts with (Rook's run then sees other
  bots and cards; the rules are unchanged). That is why `bakeWorlds` waits until a run leaves the
  Dune world. Adding upgrades to a pool TR-9 draws from shifts his card rolls the same way; the
  first minute then plays out differently and the playthrough needs a rerun.
- The playthrough's animation frames sit on a fixed grid of 64 ms (the fake clock's timers can fire
  late on a busy machine), so each step is the same length.
- The rules draw only through `rand()` (never `Math.random` directly, or a weekly run stops
  repeating); in a normal run it calls `Math.random`, so the playthrough's seeded `Math.random`
  still makes its run repeat. Drawing and other cosmetics use a hash (the ground decoration and the
  bolts' kinks use their own), never `Math.random`: in a normal run `Math.random` is the rules'
  stream, so a cosmetic draw would shift the seeded sequence the test relies on. Only a weekly run
  is shielded, by its own generator. The Dune world's spawning draws in the same order as before the other planets came, so keep
  it that way.
- Bosses are `kind: 'boss'` on every planet; which one it is comes from `PLANETS[state.planet].boss`.
  The boss's timers reuse `shellMs`, `spawnMs` and `modeMs` with a meaning per boss `mech` (see
  `bossAttacks`).
- `state.planet` is an index into `PLANETS`, not how far the run has come: use `state.stage` for
  that (deeds, arena size, the escort's and thawed troopers' damage, the save's `furthest`).
- `blades.ts` and `sim.ts` import each other. That works because each only calls the other's
  functions at run time; don't read the other module's values at load time (top-level constants
  built from imported values).
- The knights' random calls (crits, dodges, Persuasion) only happen when a knight is played (the
  same for Elara's and Triad-77's in `squad.ts`), and their pools are filtered out of a soldier's
  card roll before `rand` is used, so a soldier's seeded playthrough plays exactly as before.
- `squad.ts` imports `sim.ts` like `blades.ts` does; the same rule about load-time values holds.
- Triad-77's health lives in its bots: `p.hp` is recomputed from `state.bots` each step
  (`syncSquad`), so anything that changes it must go through `heal` or `hurtHero`.
