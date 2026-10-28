# Space Wars: guide for agents

How Space Wars is built and where things stand, for agents changing it. README.md covers how to
play, the factions and the difficulty. Keep this file up to date with any change to the game, per
the root AGENTS.md.

## Current state

Space Wars is an RTS on a random star map, played with taps, box selection and a scrolling camera.
The battlefield is 1600 by 1000 pixels; the screen shows a window of it (960 by 406 at the designed 960x540 view, more on a wider or
taller screen) between the top
and command bars. Five factions each start with a hub and two harvesters at a fixed start point.
The player picks one of the five factions on a picker before each battle; the other four are AI.
The art is a 1970s sci-fi paperback cover: low-poly 3D models baked into sprites at boot (see
`art/` below), an airbrushed backdrop and a chocolate-and-mustard HUD with cream pill buttons.

Implemented today:

- Random maps (`game/map.ts`): hubs at the fixed `START_POINTS` (`game/arena.ts`), each nudged up to
  36 px at random; three crystal nodes near each hub and 16 loose ones (`generateMap(count, loose)`:
  fewer in a harder campaign sector), 12 rock fields that block
  building, eight nebulae, 480 stars and three derelict stations. `beaconNode` picks the relay
  beacon's node (the world takes it out of `nodes`), so the map can keep nebulae and derelicts off
  the lane from the player's start to the beacon. Retries that keep them clear draw on a local
  generator (`localRandom`), so the map takes the same count from `Math.random` however many
  retries, and the stars and the battle's own randomness repeat as before.
- Pathing (`game/pathing.ts`, `World.pathing`, `steer`, `offRocks`, `spread`, `nudge`): every flight goes
  through `approach`, which flies straight when `Pathing.clear` says the way is open and otherwise
  follows `Pathing.route`, an A* path on a 20 px grid (`PATH_CELL`) round the rocks, heading for the
  furthest waypoint in a straight line. A path is kept per ship (`World.routes`, a `WeakMap`) and
  found again every `ROUTE_MS` (1 s) or once the destination moves a cell. A ship keeps its centre
  `UNIT_RADIUS - ROCK_OVERLAP` (6 px) off a rock's edge (`offRocks` slides it off); rocks round its
  destination (within `REACH`, 14 px, of its stop) are left out, so a node or target among the
  rocks can still be reached, and a move order onto a rock stops at its edge. After the units act,
  `spread` pushes warships (not harvesters or convoy ships) closer than `SPREAD` (18 px) apart at up
  to `SPREAD_SPEED` (40 px/s); a ship on a move order holds its course and the other gives way, and
  no push puts a ship over a rock. An idle ship left over a rock drifts off it. No `Math.random`.
- Nebulae (`World.inNebula`, `Unit.nebula`, `updateCover`): a ship inside one flies at 70% speed
  (`NEBULA_SLOW`) and is hidden from an enemy faction (`hidden`) unless that faction has a ship
  within 70 px (`NEBULA_SPOT`), a building within 70 px of its edge or claimed sensors in range, or
  the ship fired in the last 1.5 s (`revealMs`, shared with the cloak). `updateCover` works the
  cover out once an update into `spotted` (unit id to the factions that see it). Hidden ships are
  skipped by `nearestEnemy` and drop out of an attacker's order, so a chase into a nebula is lost
  until the chaser is close. The scene draws each nebula's edge as a faint dashed ring and the
  player's own hidden ships at 0.6 alpha.
- Veteran ships (`Unit.kills`, `Unit.lastHitBy`, `World.credit`, `rankOf`, `veteranBonus`): the ship
  whose shot landed last on a destroyed enemy ship (`lastHitBy`; turrets, mines and derelict guns
  give no credit) gets the kill, and at 3 and 8 kills (`VETERAN_RANKS`) it ranks up, Veteran then Ace
  (`VETERAN_NAMES`): +15% damage and hit points per rank (`VETERAN_STEP`), the hull scaled on the
  spot like a hull research level. Gold chevrons above the ship show its rank, the hover label names
  it, and the player's rank-ups pop a notice (naming the flagship by its own name).
- Repair and fall back (`REPAIR_RANGE`, `REPAIR_RATE`, `World.fallBack`, `sendHome`, `repairSpots`,
  `Unit.repairing`): any ship within 120 px of a finished hub, outpost or Depot of its faction gets
  back 3% of its hit points a second (a green cross beside it). The Fall back button at the right of
  the message line (`FALL_BACK_BUTTON` in `layout.ts`, kind `command`, also the B key, since F is the shared full screen key) sends the
  selected ships to a point 30 px short of their nearest repair spot. The AI pulls a warship below
  30% (`AI_FALL_BACK_HP`) home when it is not on a raid, and leaves repairing ships out of raids.
- Attack alerts (`WorldEvent` kind `hit`, `World.alarm`, `GameScene.alerts`, `alarm`, `drawAlerts`,
  `jumpToAlert`): every rival hit on a player unit or building (a shot, a splash, a mine; not on a
  decoy, never in watch mode) pushes a `hit` event with the spot and what was hit (`Struck`:
  `harvester`, `ship` or `building`). The scene moves the live alert within `ALERT_NEAR` (160 px)
  to the newest hit or raises a new one, which says what is under attack on the message line (`alertHarvesters`,
  `alertShips`, `alertBuilding`); an alert lasts `ALERT_MS` (8 s of scene time) after its last hit.
  Each draws a pulsing `ALERT_COLOR` ring on the map (still with reduced motion), and one off screen
  an arrow on the map's edge (`edgeMarks`, drawn on `uiGfx`); Space (`keydown-SPACE`) or a tap on an
  arrow centres the map on the alert. The events change nothing in the battle, so the seeded
  playthrough plays as before.
- Rally point (`Side.rally`, `rallyNext`, `World.setRally`, `clearRally`, `toRally`, `RALLY_SPOTS`;
  `RALLY_BUTTON` in `layout.ts`, kind `command`, key `rally`, also the R key; `GameScene.rallyMode`,
  `drawRally`, `drawRallyButton`): the button arms rally mode, and the next tap on the map plants the
  player's rally point there (a tap within `RALLY_GRAB` 22 px of the flag takes it down; right-click
  or the button again cancels). Each new warship from a Barracks or a held derelict shipyard then
  gets a move order to the next of `RALLY_SPOTS` round it (the point, 6 at 24 px, 12 at 46 px), and
  takes up targets in sight once it arrives. Harvesters and ships already flying are left alone.
  The flag is a mustard pennant with a dashed ring and a faint line from each finished Barracks. The
  AI never sets one.
- Minimap (`MINIMAP` in `layout.ts`, `GameScene.drawMinimap`, `fromMini`, `miniDrag`, `MINI_KEY`):
  a 160 by 100 box in the map's bottom-right corner, one pixel a fog cell. A canvas texture
  repainted every `MINI_EVERY` (6) frames from `fog.visible` and `fog.explored` holds the
  background; `miniGfx` draws known crystal, the beacon, known buildings (squares), seen ships
  (dots, selected ones bigger), the alerts and the camera's window over it each frame. A press on
  it centres the map there and a drag keeps following (in watch mode too); it is hidden on the
  picker.
- Select the fleet and spread a wing (`World.fleet`, `GameScene.selectFleet`, `ARMY_TAB` in
  `layout.ts`): a tap on the army count on the top bar (`World.fleet`'s count, decoys left out), or Q
  (`keydown-Q`), selects every warship.
  `World.command` sends a wing of two or more on a move to the `RALLY_SPOTS` round the point, so it
  fans out instead of stacking; an attack order is unchanged.
- Derelict stations (`World.derelicts`, `Derelict`, `updateDerelict`, `DERELICT_DEFS`): three neutral
  wrecks per map, one of each `DerelictKind`: `sensors` (the owner sees 280 px round it,
  `SENSOR_RANGE`, stamped into the player's fog and spotting ships in nebulae), `shipyard` (it is a
  producer for the owner's combat units in `train`, beside its Barracks) and `gun` (it fires
  `DERELICT_GUN` at the owner's enemies within 170 px). A faction alone in the 60 px ring
  (`DERELICT_RADIUS`) with warships fills `claim` in 10 s (`CLAIM_MS`), draining a rival's claim first
  (which costs the owner the station), and owns it until another takes it; a fallen owner loses its
  stations. They show once the player has seen them (`derelictAt` for the hover label), cannot be
  destroyed or built beside, and the player can build at them only in the sense of training. From
  60 s (`AI_CLAIM_MS`) a rival with 3 warships sends one idle ship (`Side.claimer`) to the nearest
  station it does not own within 600 px of its hub (`contestDerelicts`), sends it back whenever it
  is idle away from the station (after a chase, a salvage run or repairs), and frees it once the
  station is its. Salvage runs and the beacon picket never take the claimer. Ships still queued at a
  shipyard that changes hands are refunded to its old owner (`refundQueue`), and a player ship that
  `train` queues at the shipyard rather than a Barracks pops a notice.
- Truces and tribute (`Side.truceMs`, `offerMs`, `offerCooldownMs`, `grudgeLockMs`, `pressure`,
  `World.atPeace`, `acceptTruce`, `declineTruce`, `bribe`, `bribeTarget`, `considerTruce`,
  `updateTruce`): a rival whose grudge is the player offers a truce when its hub is under 75% or it
  has lost 3 ships to the player lately (`pressure`, fading one every 10 s), with 40 crystal of
  tribute (`TRUCE_TRIBUTE`); the offer stays open 25 s (`OFFER_MS`) and it waits 120 s before the next.
  Accepting gives 90 s (`TRUCE_MS`) of peace: `nearestEnemy`, `nearestEnemyBuilding`, mines, splash
  and the AI's raid target all skip a faction at peace, and ships already sent at each other are
  called off. A player command to attack a rival under truce breaks it. Tribute (`BRIBE_COST` 60)
  turns a rival's grudge onto the living faction nearest its hub (other than the player) for 60 s
  (`BRIBE_MS`): hits do not move the grudge while `grudgeLockMs` runs, and its ships already sent at
  the player turn on that faction's hub. The rivals panel (`RIVALS_PANEL` in `layout.ts`,
  `GameScene.rivalsOpen`, `rivalButtons`, `drawRivals`) opens from the rivals area of the top bar
  (`RIVALS_TAB`, which glows while an offer waits) or with T, and shows each rival's grudge, truce or
  offer with Accept, Decline and Tribute buttons; a hint on the map's top right names an open offer.
  No offers or panel in watch mode.
- Harvesting: harvesters seek the crystal nearest their home hub (`Unit.home`: the hub or outpost
  that trained them), mine it, carry it to the nearest hub, outpost or depot of their faction and
  deposit it. Nomad Freight carries 14 a trip, the others 10.
- Fog of war (`game/fog.ts`, stamped in `World.updateFog`): a 10 px grid of `explored` and
  `visible` cells for the player only. Ships see `sight` times 1.2 (scouts 1.6), harvesters 80 px,
  the hub 175 px and other buildings 110 px past their radius. Rival units show only in sight
  (`seesUnit`); rival buildings once seen stay drawn as last seen (`known`, a `SeenBuilding` per id
  with its faction, type, place and whether it was finished, refreshed while in sight; the scene
  draws fogged ones and their minimap squares from it, so their fall, completion or change of owner
  shows only once their spot is in sight again, when a fallen one is forgotten); crystal nodes,
  the beacon, shards, beams and fireballs show only where explored or in sight; the player can only
  build on explored ground. `entityAt` finds what the map shows: units in sight, the player's own
  buildings and rivals' from `known` (so the hover label names a fogged one as last seen, even one
  fallen since). A tap on a fogged one is an attack whose order carries `seen` (its spot and owner
  as last seen): the ships fly at it, and if it has fallen they fly on to the spot until it is in
  sight, then take up targets there; still standing, they attack it. The AI is not fogged.
- Expansions (`Build` = a building role or `'expansion'`, `expansionStats`): an outpost is a
  `Building` of type `hub` with `expansion: true`, drawn at 0.8 of the hub's size and named by its
  faction's `outpost` (`Sun Outpost`). 250 crystal, 18 s, 60% of the hub's hp; it goes within 120 px of a
  crystal node and 400 px or more from the faction's hubs. It trains harvesters and takes crystal,
  and buildings can go within 240 px of any finished hub (`hubsOf`). `hubOf` is the main hub
  only; only the main hub's fall ends a faction or counts for the `hubs` contract.
- Research (`game/research.ts`, `World.research`, `updateResearch`): hull, weapons and engines,
  three levels each (100, 160, 240 crystal times the faction's cost multiplier, 20 s at the hub,
  one at a time), each +10% to every ship's hp, damage or speed in `unitStats`. A hull level also
  scales ships already flying. State in `Side.research` (`levels`, `current`).
- Building: Depot, Barracks and Turret, each placed within 240 px of a hub on clear ground, built
  over time with a progress bar. A Turret shoots enemies in range. Each faction calls its Barracks
  something else (Solar Concord: Orbital Dock); the command bar shows the role under each name
  (`Barracks · 100`), and train and build messages name the faction's own building.
- Training: a harvester is queued at the hub; the combat units (scout, gunship, heavy) are queued
  at a finished Barracks, up to five at a time per building.
- Orders: move, attack a unit or building (one under the fog as last seen, see Fog of war), and
  auto-attack anything in sight when a unit has no order. Harvesters are never ordered.
- AI (`World.think`, once a second per rival): keeps four harvesters (three more per outpost),
  builds a Depot, a Barracks and up to two Turrets, trains combat units up to 20, and after the
  opening 75 seconds sends its army (less its picket and two ships kept home) every 12 seconds,
  once the army reaches the difficulty's size, at the faction that hit it last (`Side.grudge`, set
  in `shoot`) or else the nearest enemy building, so rivals fight each other. From 120 s it
  researches its lowest track and from 150 s builds one outpost (`expand`) at a field away from
  every other hub, saving crystal for both (no training) once its army is big enough. Idle
  warships fetch their faction's shards within 360 px (`fetchSalvage`).
- Watch AI (`?watch`, `shared/watch.ts`): `newGame` skips the picker and starts
  `new World(layout, random pick, true)`. With `World.watch` the AI thinks for slot 0 too (and it
  can hold the beacon picket), the fog is lifted (`updateFog` fills it and knows every building,
  `seesUnit` shows every ship, cloaked or in a nebula),
  contracts don't run (the contract pill and panel say `noContractsWatching`), and the battle ends with `phase` `won` once one faction is left
  (`World.winner`, a side index). The scene runs `update` `watchSteps()` times a frame, ignores
  taps except on the end overlay (which starts another battle), and the overlay names the winner.
  `think` reports builds, outposts, research and attacks to `aiLog`.
- Faction abilities (`Ability` in `game/factions.ts`, applied in `game/world.ts`): `cloak`
  (Phantom Blade, hidden from enemies until it fires for 2 s), `decoy` (Decoy Wraith drops a copy
  every 15 s that draws fire for 12 s and never acts), `hack` (Hack Frigate's hits disable a turret
  for 6 s, and `takeover` (6) hits in a row while it is dark make it the hacker's own turret, as
  damaged as it was: `takeOver`, counted in `Building.hacks`), `mines` (Veil Syndicate's Mine
  Lattice lays a hidden mine within 130 px every 8 s, up to 4, while not hacked: `World.mines`,
  `layMine`; an enemy ship within 16 px sets it off for 45 damage within 40 px: `updateMines`; a
  rival's mine is drawn only with a player ship within `MINE_SPOT` 60 px), `shield` (Halo Cruiser: friends within 70 px take half of each shot), `brood` (Brood
  Carrier spawns a scout every 12 s up to 6 scouts), `splash` (Siege Barge hits enemies within 28 px
  of its target for half damage), `salvage` (Nomad Salvage Yard pays 8 crystal per enemy unit
  destroyed within 200 px).
- Contract board (`game/contracts.ts`, state in `World.contract`, run by `World.updateContract`,
  `openBoard`, `startContract`, `failContract` and `score`): five contracts a battle (`CONTRACT_STEPS`,
  ranks `RANKS`). The first is always `FIRST_CONTRACT` (raise the Barracks). Each one done pays its
  reward and applies its perk to `sides[PLAYER].perks` (train time, turret range and damage, ship
  speed, hit points, damage, sight and cost, harvester carry, repair rate), which `unitStats`,
  `buildingStats`, `harvest` and the repair rule multiply in; then the board opens: `contract.goal`
  is null and `offer` holds two goals from `CONTRACT_POOL`, drawn by `boardOffer` from those open at
  that step (`from`), not `taken` yet and open in this battle (`contractOpen`: a living Veil rival
  for `lattice`, a far field for `convoy`, fewer than two derelicts held for `derelicts`, a rival not under truce and not held by tribute for
  `survive`; a `survive` card taken once every rival is at peace or paid off fails at once, `noRaiders`). The second
  board always offers `kills` first (the playthrough takes it). `World.pickContract(goal)` takes a
  card; after `BOARD_MS` (15 s) the first is taken. The draw uses the world's own `rng`
  (`localRandom` seeded from the player's start), never `Math.random`, so the battle's randomness is
  untouched. Goals: `kills`, `razes`, `hubs` and `lattice` (a Mine Lattice razed) count in
  `removeDead` when the player's shot (`lastHit`) landed last; `hold` in `updateBeacon`; `barracks`,
  `derelicts` (held now), `nebula` (`nebulaHeld`: a player warship in a nebula no enemy warship is
  in) and `survive` (seconds since `raidPlayer` sent the fleet of every rival not under truce or held by tribute at the hub) in
  `updateContract`; `convoy` when a convoy harvester arrives. The convoy (`launchConvoy`,
  `convoyField`, `escort`, `endConvoy`, `World.convoyTo`, `Unit.convoy`): `CONVOY_SIZE` (3) new
  harvesters fly from the hub to the crystal node nearest 600 px away (420 to 820), the rival
  whose hub is nearest it sends up to 3 warships at them, an arrival starts mining that node, and
  when fewer than the target can still arrive the contract fails: the board opens again for the
  same rank. `lattice` fails the same way once `contractOpen('lattice')` turns false (no living
  rival with a Mine Lattice faction is left, so none can be razed any more). `contract.done` lists the goals finished (the campaign keeps a perk from them). The
  top bar's pill and the command bar's panel show the current contract or the board's countdown;
  the board itself is two cards over the map (`GameScene.boardCards`, `drawBoard`), hidden while the
  rivals panel is open.
- Rival contracts (`Side.deal`, `Deal`, `World.updateDeals`, `dealScore`, `AI_DEAL_MS`, `AI_GOALS`,
  `nearestEnemyHub`): from 90 s every AI side (slot 0 too when watching) works through a chain of
  its own, board steps 1 to 4 (`deal.step`, ranks II to V), picking a goal from `AI_GOALS` (`kills`,
  `hold`, `derelicts`, `razes`, `hubs`) open at that step and not done (`derelicts` only while it
  holds fewer than two, like the board; it waits while that is all that is left), with the world's `dealRng`
  (a `localRandom` of its own, so neither the board's draws nor `Math.random` move). It counts in
  `removeDead` (a kill, raze or main hub whose last hit was the side's), `updateBeacon` (seconds
  held) and `updateDeals` (derelicts held now); met, it pays the reward and applies the perk to the
  side's `perks` (which `unitStats` and the rest already read), and the player gets a notice
  (`rivalDealDone`). One not met in `AI_DEAL_LIMIT_MS` (180 s) is dropped and picked again. A rival
  plays to its contract: `kills`, `razes` and `hubs` attack with `AI_DEAL_EAGER` (2) ships fewer
  (at least 2), `hubs` at the nearest main hub (its grudge's while tribute holds it); `hold` keeps a picket on the beacon whatever its
  rank in `contestBeacon`; `derelicts` claims stations at any reach with `AI_DEAL_CLAIM_ARMY` (2)
  warships. The rivals panel shows each one's contract and progress (`GameScene.rivalDeals`,
  `rivalDeal`, `rivalDealsDone`), and `updateDeals` logs `aiDeal` and `aiDealDone` to `aiLog`. The playthrough
  ends before 90 s, so it plays as before.
- Flagship (`Side.flagship`, `World.buildFlagship`, `updateFlagship`, `flagshipStats`, `Unit.flagship`,
  `Faction.flagship` in `game/factions.ts`): the third contract done (`FLAGSHIP_STEP`) turns the
  player's flagship from `locked` to `ready`. The Flagship button (`FLAGSHIP_BUTTON`, kind `command`)
  pays `FLAGSHIP_COST` (400 times the faction's cost) and builds it at the hub in `FLAGSHIP_MS`
  (25 s), then it launches as a `heavy` with `flagship: true`: 3x hit points, 1.6x damage, +20 range,
  0.7x speed (`FLAGSHIP_HP`, `FLAGSHIP_DAMAGE`, `FLAGSHIP_RANGE`, `FLAGSHIP_SPEED`), and the faction's
  flagship ability in place of the heavy's (`abilityOf`, public so the scene draws shields and
  cloaks from it; a salvage flagship pays in `salvage`). It is drawn as the heavy at 1.45x on a gold
  ring. Lost, it is `lost` for the rest of the battle. The AI never builds one.
- Last-stand pact (`World.pact`, `updatePact`, `signPact`, `raidPlayer`): from 75 s, once at most
  two rivals are left or the player holds more than a third of the finished hubs, the rivals left
  sign it: truces and offers end, grudges turn on the player, each gets 100 crystal, `atPeace` is
  true between any two rivals, tribute (`bribe`, `bribeTarget`) and truce offers stop. After
  `PACT_MS` (60 s), then every `PACT_WAVE_MS` (45 s), `raidPlayer` sends every rival warship but the
  picket and claimer at the player's hub (`pact.waves` counts them). A banner on the map's top left
  counts down (`drawPact`) and the rivals panel says who is in it. Not in watch mode.
- Sector campaign (`game/campaign.ts`, `GameScene.campaign`, `sector`, `sectorNodes`, `keepCards`):
  five `SECTORS` in a chain, saved under `space-wars-campaign` (`unlocked`, and `kept`: the perk goal
  kept from each sector won). The picker shows a strip under the cards (`drawSectors`): the chosen
  sector, what makes it hard (`sectorText`), its node chain and the perks it carries in
  (`keptFor`). The furthest open sector is chosen for the first map and after a victory
  (`newGame(furthest)`), and a defeat keeps the sector just lost; tapping another open
  node makes a fresh map for it (`makeMap`, since the loose node count changes). `new World(layout,
  pick, watch, sector, kept)` applies the kept perks to the player and gives each rival the sector's
  crystal and research levels and, for the first `outposts` rivals, a finished outpost
  (`seedOutpost`, at `expansionSpot` with any field and a looser gap if need be). A victory shows a
  card per goal in `contract.done` (`drawKeep`); tapping one runs `winSector` (keeps it, opens the
  next sector) and saves; with no card any tap does. Watching always plays sector 1 and leaves the
  campaign alone.
- Relay beacon (`World.beacon`, `World.updateBeacon`): the loose crystal node nearest the point
  halfway from the player's start to the map's centre, at least 300 px from every rival start
  (`beaconNode` in `game/map.ts`), is taken out of `nodes` and becomes the beacon. A faction alone in its 70 px ring with warships
  fills `capture` in 5 s (draining a rival's first) and then owns it; the owner gets 3 crystal a
  second while one of its warships is in the ring (`held`). `paid` counts what it paid the player.
  It sits at least 200 px from the player's start, outside the hub's sight, so it starts hidden in
  the fog. Buildings keep clear of it. The two rivals whose hubs are nearest the beacon each send
  one idle warship (`Side.picket`) to contest or hold it (`World.contestBeacon`), the nearest from
  30 s on, the next from 120 s; a lost picket is replaced, and one that chased a target off the
  beacon flies back once idle.
- Salvage (`World.shards`, `World.updateShards`): a ship destroyed by another faction (not a
  decoy) leaves a shard worth 8 for that faction (`Shard.faction`); the nearest unit of that
  faction within 260 px pulls it in at 220 px/s and banks it on contact (`salvaged` counts the
  player's). Shards fade after 45 s, and go with a fallen faction.
- Floating numbers and one-off notices: `World.pops` (+8 and +3 over the map, aged in `update`) and
  `World.events` (`notice` for the command bar, `gain` for the flash by the crystal count, `hit` for
  attack alerts and `cue` for a sound, see "Sound"), which the scene empties each frame.
- Win: every rival hub gone. Lose: the player's hub gone. A fallen hub takes its faction's
  remaining units and buildings with it. A battle ends with a Victory or Defeat overlay; a tap starts
  a new map.

- Faction picker: a new map opens on a picker with a card per faction. Tapping a card starts the
  battle with that faction under the player's command (`World(layout, pick)`: it takes slot 0, the
  bottom-left start, and the others fill the rest in order). The world does not update while picking.
- Camera and hover: arrow keys and WASD scroll the map, and so does dragging with two fingers on a
  touch screen (`touchPan`, `twoFingers`: a second finger cancels the first one's box), H centres it on the hub, and hovering a unit
  or building shows its name, role, hit points (a rival building's only while in sight) and stats. Hovering a command button shows what it is
  (cost, stats, ability). Selecting one unit shows its name and hit points on the command bar.

Missing or rough:

- Pathing is round rocks only: ships still fly over buildings, nebulae and the derelicts, and
  spread apart softly rather than colliding. No save of a battle in progress (only the campaign is saved). No ambient hum under the music, and no per-faction music motif.
- No edge scrolling: the map scrolls with the keys, a two-finger drag or the minimap.
- The rivals' Barracks and Turrets are placed at random within 60 to 150 px of their hub.
- The AI runs its own contracts but doesn't play against the player's (beyond hunting a convoy and
  the survive raid), and never takes the convoy, nebula, lattice or survive contracts. It sees through the fog
  (but not into nebulae). Rivals left alone wipe each other out fast: the centre faction usually
  falls first, until the last-stand pact turns the last two on the player.
- Only the player makes truces and pays tribute; rivals never make peace with each other. The AI
  never bribes.
- The playthrough covers only the first round (harvest, raise a Barracks for the first contract,
  tap Break the raid on the contract board, train three Lancers, find the beacon in the fog and take it, fight off its picket for salvage,
  attack a base). Purchases
  beyond that round, the other buildings and the other units are not played.

## Architecture

File map (`src/`):

- `howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English, US English (the same with "Center") and German, picked with `byLanguage` and handed to
  `setupGame(game, { howToPlay })` in `main.ts`; update every language when the controls or the
  first round change.
- `i18n.ts` and `i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British English
  source, `i18n/de.ts` the German (faction, ship and building names are compound nouns used without
  an article, so they fit any sentence) and `i18n/en-US.ts` the texts spelled differently in US
  English (none yet). `t(key, vars)` shows a text in the hub's language; `TextKey` types the keys.
  Every text on screen, the notices and problems `World` returns and the Watch AI log go through
  `t` (`tr` in `GameScene`, where `t` names the text helper in `create`); game logic compares ids
  and keys, never shown text.
- `trophies/`: the game's trophies (`shared/trophies.ts`). `index.ts` lists them with `trophySet`
  (it imports only its own texts, since the hub loads it), `i18n/en.ts` and `de.ts` hold the names
  and `<id>Text`s, and `check.ts` has `checkTrophies(world)`, which `GameScene.update` calls every
  frame after the battle steps: it awards each trophy whose condition (`EARNED`) holds, never while
  watching. The trophies: `firstContract` (bronze, a contract done), `beacon` (bronze, the beacon
  owned), `truce` (bronze, a rival under truce), `ace` (silver, a player ship with Ace's kills),
  `derelicts` (silver, all three derelicts held), `flagship` (silver, the flagship out), `victory`
  (silver, a battle won), `outpaced` (gold, all five contracts done while no rival's `deal.step`
  has reached `CONTRACT_STEPS`) and `campaign` (gold, hidden: the last sector won). A battle never
  replays time, so no award is quiet.
- `audio.ts`: the game's sound (see "Sound" below): `SONG`, the `sfx` table, its `Sfx` names and
  `LASER_PITCH`. Only `GameScene` imports it.
- `main.ts`: creates the `Phaser.Game` (960x540, `Phaser.Scale.FIT`, `pixelArt: false`) with
  `GameScene`, calls `setupGame(game, { howToPlay, trophies })` from `shared/setupGame.ts` and `setupScaling(game, { fill: true })` from
  `shared/scaling.ts`, and in dev builds puts `game` on `window`. The canvas has `renderScale`
  canvas pixels per view pixel (see "Screen scaling" below).
- `game/factions.ts`: the `FACTIONS` list (name, outpost name, colours, `tune` multipliers, the
  `units` and `buildings` definitions with their outlines and optional `ability`, and the
  flagship). Every name is a `TextKey`; a faction's name key (`solarConcord`) is also its id, which
  `FACTION_ART` and the Solar Concord's floating pylons go by. Also `COMBAT_UNITS` and the types
  `UnitId`, `Role`, `Poly`, `Weapon`, `Ability`, `UnitDef`, `BuildingDef`. The outlines (`shape`) are
  no longer drawn; the art comes from `art/models.ts`.
- `game/fog.ts`: `Fog` (`explored` and `visible` cells, `stamp`, `sees`, `knows`; `toJSON` gives
  only the explored share, so the test's state reads stay small), `FOG_CELL` (10), `FOG_COLS`,
  `FOG_ROWS`. No Phaser.
- `game/research.ts`: `TRACKS`, `TRACK_DEFS` (name and effect as `TextKey`s), `RESEARCH_LEVELS`, `RESEARCH_STEP`, `RESEARCH_COSTS`,
  `RESEARCH_MS`, `Research`, `noResearch`, `researchBonus`. No Phaser.
- `game/contracts.ts`: `FIRST_CONTRACT` and `CONTRACT_POOL` (goal, target, reward, `from` step,
  title, brief, task and perk text through `t`, filled with the faction's Barracks or Turret name,
  and `apply` for the perk), `contractOf`, `boardOffer`,
  `RANKS`, `CONTRACT_STEPS`, `BOARD_MS`, `FLAGSHIP_STEP`, `Perks`, `NO_PERKS`, `Goal`. No Phaser.
- `game/campaign.ts`: `SECTORS` (name as a `TextKey`, rival outposts, loose nodes, rival crystal and research),
  `Campaign`, `CAMPAIGN_KEY`, `loadCampaign`, `saveCampaign`, `newCampaign`, `keptFor`, `winSector`,
  `sectorText`. No Phaser.
- `game/arena.ts`: `ARENA` (the 1600 by 1000 battlefield in world pixels), `START_POINTS` (the five
  fixed hub spots, player first), `NODE_AMOUNT`, `NODE_CLEARANCE` and `BUILD_RANGE`.
- `game/pathing.ts`: `Pathing` (built from the map's rocks and a clearance: `over`, `clear`,
  `route`), `PATH_CELL` and the `Rock` type. No Phaser, no `Math.random`.
- `game/map.ts`: `generateMap(count, loose)` returns a `MapLayout` (homes, nodes, rocks, nebulae, stars,
  derelicts), `beaconNode` (which node is the relay beacon), `DerelictKind` and `DERELICT_KINDS`.
  Uses `Math.random`, plus `localRandom` (exported: the world's board and the scene use it too) for
  the retries that keep nebulae and derelicts clear.
- `game/describe.ts`: the text for tooltips and faction cards (`unitLines`, `buildingLines`,
  `factionLines`, `abilityText`, `expansionLines`, `researchLines`, `fallBackLines`,
  `derelictLines`, `rallyLines`), built from the faction data in the hub's language. No Phaser.
- `game/world.ts`: `World`, the whole battle. `new World(layout, pick, watch, sector, kept)` puts faction `pick` in the
  player's slot (`watch`: the AI plays it, see Watch AI above; `sector` and `kept`: the campaign). `PLAYER` (0), `unitStats` and `buildingStats`
  (faction numbers with the faction's multipliers, the side's perks and research applied),
  `expansionStats`, `buildInfo` (what a build button costs and is called), `researchCost`, the
  expansion constants (`EXPANSION_COST`, `EXPANSION_NEAR`, `EXPANSION_GAP`), `MINE_SPOT`, the beacon and
  salvage constants (`BEACON_RADIUS`, `CAPTURE_MS`, `BEACON_PAY`, `SHARD_VALUE`, `SHARD_MAGNET`,
  `POP_MS`), the nebula, veteran, repair, derelict and truce constants (`NEBULA_SPOT`,
  `NEBULA_SLOW`, `VETERAN_RANKS`, `VETERAN_STEP`, `VETERAN_NAMES`, `REPAIR_RANGE`, `REPAIR_RATE`,
  `DERELICT_RADIUS`, `CLAIM_MS`, `SENSOR_RANGE`, `DERELICT_GUN`, `DERELICT_DEFS` (name and text
  keys; `derelictText` fills in the numbers), `TRUCE_MS`,
  `TRUCE_TRIBUTE`, `OFFER_MS`, `BRIBE_COST`, `BRIBE_MS`), `RALLY_SPOTS`, the flagship, convoy and pact constants
  (`FLAGSHIP_COST`, `FLAGSHIP_MS`, `FLAGSHIP_HP`, `FLAGSHIP_DAMAGE`, `FLAGSHIP_SPEED`, `FLAGSHIP_RANGE`,
  `CONVOY_SIZE`, `PACT_MS`, `PACT_WAVE_MS`), the rival contract constants (`AI_DEAL_MS`, `AI_GOALS`), `flagshipStats` and the types `Beacon`, `Deal`, `Shard`, `Mine`,
  `Pop`, `Build`, `ContractState`, `Pact`, `WorldEvent`, `Struck`, `Cue`, `Derelict`, `SeenBuilding`. Fields `fog`, `known`, `mines`,
  `derelicts`, `contract`, `convoyTo`, `pact`, `sector`. Methods the scene and test use: `update(dt)`, `build`, `train`, `research`,
  `command`, `fallBack`, `setRally`, `clearRally`, `fleet`, `pickContract`, `currentContract`, `buildFlagship`, `abilityOf`, `acceptTruce`, `declineTruce`, `bribe`, `bribeTarget`, `selectableIn`,
  `selectable`, `entityAt`, `derelictAt`, `placementProblem`, `count`, `hubOf`, `hubsOf`,
  `seesUnit`, `seesMine`, `inNebula`, `atPeace`, `rankOf`, `veteranBonus`, `unit`,
  `building`. No Phaser import.
- `scenes/GameScene.ts`: `GameScene` (key `'Game'`). Holds `state` (the `World`), `layout`, `camera`
  (the map camera), `buttons`, `selected`, `placing`, `picking` (the faction picker is up),
  `pickCards` (the picker's card rectangles, in view pixels), `rivalsOpen` and `rivalButtons` (the
  rivals panel and its buttons as last drawn), `boardCards` and `keepCards` (`GoalCard`s: the
  contract board's and the victory's perk cards as last drawn), `campaign`, `sector` and
  `sectorNodes`. The board, pact banner, convoy label, derelict labels (one per `DERELICT_KINDS`,
  placed by `drawDerelicts`), perk cards and sector strip texts, and the
  Flagship and Rally buttons' captions and the minimap, are made in `create` with `Math.random` swapped for a `localRandom`:
  every Phaser text draws its texture key from `Math.random`, so new texts made the ordinary way
  would shift the seeded playthrough's map and AI. `update(time)` steps the world by the frame
  gap (clamped to 100 ms), reads `World.events`, pans the camera from the keys and draws everything.
  Two cameras: the main `camera` shows the battlefield in the `MAP_VIEW` viewport; a second, fixed
  camera (`fixed`) covers the whole view (`VIEW`, 960 by 540 or bigger, see "Screen scaling"). Both viewports are set in canvas pixels
  (`renderScale` times the view's), and both keep the zoom and top-left origin `setupScaling`
  gives them, so `scrollX` and `scrollY` stay the battlefield point at the map's top-left corner. Every object is made through `onMap` (the
  fixed camera ignores it) or `onUi` (the map camera ignores it), so the bars and text never
  scroll. Ships, buildings, crystals and shards are Images kept in maps by entity id, made when an
  entity appears and destroyed when it goes (`drawShips`, `drawBuildings`, `drawShards`); each
  ship shows the baked frame nearest its heading (`facing`), rotated by the few degrees left over,
  with an exhaust flame Image behind it while it moves. The fog (`drawFog`) is a canvas texture,
  one pixel a cell box-blurred and smoothed up 3x, stretched over the battlefield above the ships
  and repainted every third frame. Mines are drawn on `underGfx` (`drawMines`), a hacked turret
  fills a cyan ring toward its takeover, and research buttons are drawn by `drawResearchButton`.
  Beams, fireballs, rings and health pills are Graphics redrawn each frame (`underGfx` under the sprites, `gfx` over them), as are the nebula edges (`drawNebulae`), the derelict stations with their claim arcs and labels (`drawDerelicts`), the veteran chevrons and repair crosses (in `drawShips`), the Fall back pill (`drawCommandButton`) and the rivals panel (`drawRivals`, on `pickGfx`). `toWorld(x, y)` and `toScreen(x, y)` convert between view pixels and
  battlefield pixels from the camera's scroll. Input: `onDown`, `onMove`, `onUp` (box or tap; each
  reads the pointer in view pixels through `viewPoint`),
  `tapMap`, `press` (buttons). Bars and drag boxes use view pixels; placement and commands use
  battlefield pixels, converted with `toWorld`.
- `scenes/layout.ts`: `DESIGN` (960x540, the game's config size), `VIEW` (the view the HUD is laid
  out in), `GROW` and `LEAD` (see "Screen scaling"), `fitView`, `CONTRACT_PILL` (the top bar's contract pill), `TOP`, `BAR`, `MAP_VIEW` (the map's window on screen), `BUTTON`
  (112 by 30), `GRID_X` (64: where the build and train rows start, leaving the bar's bottom-left
  corner to the shared corner buttons), `BUTTONS` (each button's kind, `build`, `train` or `research`, key and top-left
  corner: four build buttons with Expansion last, four train buttons, and the research column),
  `RESEARCH_COLUMN`, `FALL_BACK_BUTTON` (kind `command`, key `fallback`, at the right of the message
  line), `FLAGSHIP_BUTTON` (kind `command`, key `flagship`, above the build row), `RALLY_BUTTON`
  (kind `command`, key `rally`, last in `BUTTONS`, left of the Flagship button),
  `BOARD` (the contract board's header and cards), `SECTOR_STRIP` (the picker's campaign strip),
  `KEEP` (the victory's perk cards), `MINIMAP` and `ARMY_TAB`, `PANEL_X` (where the message line and contract panel start), `RIVALS_PANEL` and `RIVALS_TAB`
  (the rivals panel's box and the top bar area that opens it), `ROLE_LABEL` (the generic
  name of each building and unit type as a `TextKey`, shown under the faction's own name), `FONT` (a system sans
  stack, bold italic for headings).
- `art/mesh.ts`: the modelling kit. `Mesh` (vertex and face lists, each face with a material key),
  primitives `box`, `tube` (and cones), `ellipsoid` (and domes), `slab` (an extruded outline),
  `plate`, `crystal`, `band` and `ring` (curved strips), `rock`; transforms `move`, `scale`,
  `turn`, `mirrorY`, `pair`, `merge`, `xform`; `hashRandom` (never `Math.random`). Models face
  +x, +z is up, in display pixels.
- `art/render3d.ts`: `renderMesh` turns a mesh to a heading, tilts it toward the viewer (`TILT`),
  culls back faces, sorts by depth (painter's order) and fills each face with a top-left to
  bottom-right gradient. Materials are `paint` (Lambert plus a highlight), `chrome` (reflects a
  painted sky, horizon and desert), `glass` and `glow` (unlit, blooms with a canvas shadow).
  Also `sparkle` (the four-pointed glint) and `reach`.
- `art/models.ts`: `FACTION_ART` (by faction name key: materials, the four ship and four building
  meshes, and the flame colours) and the props (`crystalCluster`, `beaconModel`, `shardModel`,
  `rockModel`, `PROP_MATS`).
- `art/textures.ts`: `bakeAll` (once per page) bakes each faction's ships as sheets of `FACINGS`
  (16) frames (`shipKey(faction, type)`, frame k faces k x 22.5 degrees clockwise from east), its
  buildings (`buildingKey`), flames (`flameKey`), crystals, the beacon, the shard and two glows,
  at `RES` canvas pixels per display pixel with a dark ink outline. `RES` is set by `bakeAll`:
  `renderScale` held between 2 and `MAX_RES` (3), so draw sprites at `1 / RES`. A ship sheet lays
  its frames out four to a row. `bakeBackdrop` paints each map's 1600 by 1000 backdrop (sky,
  nebulae, ringed planet, moon, stars, rocks) at `sharpRes` and returns that resolution, which the
  scene draws it at `1 /`. `facing`
  picks a frame for a heading. Faction keys index `FACTIONS`, not the battle's sides; the scene
  maps sides with `art(side)`.
- `art/draw.ts`: `drawHealth`, `drawProgress`, `dashedCircle`, `progressArc`, `stripes`.
- `art/palette.ts`: `INK` and `INK_CSS`, the HUD's chocolate, tangerine, mustard and cream.

How it runs:

- Each frame `update(time)` computes `dt` from the frame timestamp (clamped to 100 ms), calls
  `World.update(dt)` and redraws everything with `Graphics` from the world's state.
- `World.update` runs, in order: beams, wrecks and pops age; nebula cover is worked out
  (`updateCover`); buildings progress (construction, training, turret fire); derelicts claim, train
  and fire; units act (repair, harvesters `harvest`, others follow their order or acquire a
  target, or a convoy harvester flies on) and warships spread apart (`spread`); each rival's truce timers run and it `think`s once a second (including `contestBeacon`,
  `contestDerelicts`, `considerTruce` and falling hurt ships back); the pact is signed or raids;
  dead entities are removed (kills, veteran credit, razes, pressure, shards and a lost flagship are
  recorded here, after mines go off); research, the flagship's build, the beacon, shards, the
  contract (and board), the rivals' contracts (`updateDeals`) and the fog update; the phase becomes `won` or `lost`.
- Boot bakes all sprites in `create` (320 ship frames and the rest); a new map only repaints the
  backdrop.
- Time is simulated, not read from the clock: `elapsedMs` is game time, used for the AI grace and
  the HUD clock.

## Sound

All sound is made in code by `shared/audio.ts`; the game's song and effects are in `src/audio.ts`,
and only `GameScene` plays them. `World` has no audio: it pushes `WorldEvent`s of kind `cue` (a
`Cue` name, and for `hubFalls` the hub's spot), which the scene drains with the notices and maps
through `CUE_SOUND`. Every cue but `hubFalls` is the player's own, so the AI's builds, training and
research make no sound.

Music, `SONG`: a synth space opera in E minor at 120 BPM (pulse lead, thin pulse harmony arpeggios,
sawtooth bass, drums). `GameScene.music` picks the part each frame and switches on a change:

| Part | When |
| --- | --- |
| `menu` | the faction picker |
| `calm` | the battle (half-time loop for the economy) |
| `battle` | while an attack alert is live, and `BATTLE_TAIL_MS` (4 s) after; watching, once two factions are left |
| `boss` | once the rivals have signed the last-stand pact |
| `win`, `lose` | stings on Victory and Defeat (the music stops first) |
| `end` | the neutral sting when a watched battle ends |

Effects, `sfx` (the shared `ui('click')` for plain buttons and choices, `ui('refuse')` for every
refused action: a build, train, research, flagship or contract the world turns down, a placement
problem, a command or fall back with nothing to send, Space with no alert, Q with no fleet). Panning
with the keys, two fingers or the minimap makes no sound:

| Sound | Where it plays |
| --- | --- |
| `laser` | `GameScene.listen`: one per frame at most, from the new beams on screen and in sight, pitched by faction (`LASER_PITCH`) |
| `boom`, `boomBig` | `listen`: the biggest new wreck, splash or mine ring in sight each frame (`BIG_BOOM` radius 22 and up is big); a rank-up's gold ring (`Effect.kind` `rank`) is skipped |
| `hubFalls` | cue `hubFalls` (`removeDead`), only when the hub is in sight |
| `select` | a tap or box that selects ships (`tapMap`, `onUp`), and the army tab or Q selecting the fleet (`selectFleet`; `ui('refuse')` with no warships) |
| `move`, `attack` | a move or attack order (`tapMap`) |
| `fallBack` | the Fall back button or B with ships sent (`press`) |
| `place` | a building placed (`onDown`) |
| `built` | cue `built` (`updateBuilding`, a player building finished) |
| `queue` | a unit, research or the flagship queued (`press`) |
| `warpIn` | cue `warpIn` (a player ship out of a Barracks, hub or held shipyard) |
| `upgrade` | cues `researchDone` (`updateResearch`) and `rankUp` (`credit`) |
| `crystal` | each `gain` event (salvage, tribute, a contract's reward) |
| `stamp` | cue `contractStarted` (`startContract`: a card tapped or the board's timer) |
| `contractDone`, `contractFailed` | cues from `updateContract` and `failContract` |
| `won`, `lost` | cues for the beacon (`updateBeacon`), a derelict (`updateDerelict`, `loseDerelict`), a hacked turret (`takeOver`), and `lost` when a truce runs out |
| `truceOffered`, `truceMade`, `truceBroken`, `tribute` | cues from `considerTruce`, `acceptTruce`, `command` (an attack on a rival under truce) and `bribe` |
| `klaxon` | cue `klaxon`: the pact signed and each pact raid (`signPact`, `updatePact`), the convoy hunted (`launchConvoy`), the survive contract's raid |
| `alert` | a new attack alert (`alarm`), once per alert, not on a refresh |
| `whoosh` | the map jumps to an alert (`jumpToAlert`: Space or an edge arrow) |
| `rally`, `rallyClear` | the rally point planted or taken down (`onDown` in rally mode) |
| `flagshipReady`, `flagshipLaunch`, `flagshipLost` | cues from `updateContract` (third contract), `updateFlagship` and `removeDead` |

Watching (`?watch`), the music plays, the lasers and wrecks play quieter, a hub falling in sight
plays, and no cue of the player's side or `gain` plays. Under browser automation the engine makes
no sound at all, and the cues change nothing in the battle, so the seeded playthrough plays as
before.

Screen scaling (`shared/scaling.ts`): the game fills every screen shape (`setupScaling(game, {
fill: true })`), so its view is 960x540 or grown to the screen's shape (up to 1296 wide or 720
tall). `GameScene.create` first calls `fitView(viewSize)` in `layout.ts`, which moves the layout
constants (they start at the designed size) in place: the command bar, its buttons and the minimap
move down by `GROW.dy`; the Fall back button, minimap, rivals panel and rivals tab pin to the right
edge (`GROW.dx`) and the contract pill moves by half of it; the message line and contract panel
stretch to the right edge; the map window (`MAP_VIEW`) takes the space between the bars, and the
picker's cards, sector strip and victory perk cards stay centred in it (`GROW.dy / 2`). The view no
longer leaves page bars for the shared corner buttons, so where they would cover the build and train
rows (`cornerSize`), a wider view moves the bar's left part right by `LEAD.x` and a taller one lifts
the bar's contents by `LEAD.lift`. At 960x540 nothing moves (the playthrough clicks there). Lay
out new HUD with these constants (or `BAR.y + offset`), never fixed numbers past the designed size.
Lay out in view pixels from `layout.ts` (never `this.scale`, which is canvas pixels), read pointers through `viewPoint`, give a new camera its
viewport in canvas pixels, and paint new canvas art at `RES` or `sharpRes`. The map camera never
follows or uses bounds (`scrollTo` clamps it), so it keeps the top-left origin rather than
`scrollingCamera`. `index.html` has the shared `100dvh` and `touch-action: none` styles.
`e2e/screens.spec.ts` checks the game on five screens.

Save keys: `space-wars-campaign` (`CAMPAIGN_KEY` in `game/campaign.ts`): the sector campaign, as
`{ unlocked, kept }`, and `space-wars-trophies` (by `shared/trophies.ts`): the trophies earned. `loadCampaign` rounds `unlocked` to a whole sector and turns a `kept` goal
the game no longer knows into `null`, so an old or hand-edited save still loads. Nothing else is kept between visits; the game reads the hub's settings
(`byDifficulty`, `settings.reduceMotion`, the language through `shared/i18n.ts`) through `shared/`. The playthrough starts with empty
storage, so it plays sector 1 with no kept perks.

Test hooks (read by `e2e/playthrough.spec.ts`):

- `window.game.scene.getScene('Game')` (dev builds only). `scene.state` is the `World`: `phase`,
  `elapsedMs`, `units`, `buildings`, `nodes`, `sides` (crystal, alive), `layout`.
- `scene.buttons`: the command bar's buttons with their positions, read to click them.
- `scene.pickCards`: the picker's cards. The test taps the first one to play the Solar Concord
  and checks its name key, `solarConcord`.
- `scene.state.fog`: its JSON is `{ explored }` (the explored share); `state.fog.knows({ x, y })`
  answers whether the player has seen a point. The test checks the beacon starts hidden and is
  found, and that flying out explores more.
- `scene.state.beacon` (`owner`, `capture`, `held`, `paid`), `shards` (with `faction`), `salvaged`, `kills`,
  `contract` (`index`, `progress`, `goal`, `offer`) and `sides[0].perks`: the test asserts the first contract's
  reward and perk, that the board offers two contracts with `kills` first, the beacon's capture and
  pay, and a kill and its salvage.
- `scene.boardCards`: the board's cards; the test taps the `kills` card.
- `localStorage['space-wars-trophies']`: the test checks the first round earns `firstContract` and
  `beacon`, and nothing else.
- `scene.selected`: the ids of the selected units; the test checks that its box selected the wing.
- Not read by the test, but there: `scene.state.derelicts` (`perk`, `owner`, `claim`), `sides[i].deal`, `sides[i].truceMs`,
  `offerMs`, `grudge`, `flagship`, `units[i].kills`, `nebula`, `repairing`, `flagship`, `convoy`,
  `state.pact`, `state.convoyTo`, `scene.rivalsOpen`, `keepCards`, `campaign`, `sector` and `sectorNodes`.
- `scene.camera.scrollX` and `scrollY`: the map's scroll, which the test reads to see whether a pan
  moved. `scene.toScreen(x, y)` gives where a battlefield point is in view pixels.
- Not read by the test either: `scene.rallyMode`, `scene.alerts` (`x`, `y`, `first`, `last`,
  `struck`) and `state.sides[0].rally`.
- `scene.state.placementProblem(role, x, y)` answers whether a building can go somewhere. The test
  calls it to pick a clear spot, then taps it.
- The test pans with the real arrow keys (`page.keyboard.down`) until the target is on screen, then
  taps it. A unit moves while the game plays, so the test reads its position right before tapping.
- Game time moves only through the test's clock; rAF is replaced with a timer at 64 ms frames.

## How to make common changes

- **A balance number**: change it in `game/factions.ts` (costs, times, hit points, weapons) or
  `game/world.ts` (the AI constants at the top). Update the playthrough if the first round depends
  on it (the Barracks cost, the Lancer's cost, the harvest rate), and the README's numbers.
- **A new faction**: add an entry to `FACTIONS` with all four units and four buildings and a
  `tune`. The map, HUD and AI pick it up by index, so `FACTIONS.length` sets the number of hubs.
  Give it models in `FACTION_ART` (`art/models.ts`, keyed by its name) in a look of its own with its colour on a stripe or glow; no red cross on any art.
- **A new building or unit type**: add it to the `Role` or `UnitId` types and to each faction's
  definitions, then the command bar's `BUTTON`s in `scenes/layout.ts` (and its `ROLE_LABEL`) and
  any `World` rules that name it (`train`, `updateBuilding`, `harvest` for drop-offs).
- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and, where US spelling differs, `i18n/en-US.ts`; then run
  `node scripts/check-translations.mjs`. German runs longer than English: the message line (two
  lines of 240 px), the Fall back pill, the role line under each build and train button and the
  end overlay are the tightest spots, so check a new text with `?lang=de`. A new faction, unit or
  building needs its name in all three files too.
- **A tooltip or card text**: add the line in `game/describe.ts` through `t`; the scene shows
  whatever it returns.
- **A map-clicked command**: convert the view pixel with `toWorld` first; the bars take view pixels.
- **Shooting and approach** share a half-pixel slack (`approach` and `updateUnit`), so a unit that
  stops at its range can always fire.
- **A new command**: add a method on `World` that the scene calls from `tapMap` or `press`. Keep
  the rule in `World` so the AI can use it too.
- **A new setting**: add it to `shared/settings.ts` and honour it here; `reduceMotion` already
  skips the fireballs, steadies the beams, flames, shard and beacon glows, keeps pops from rising
  and stops the Solar Concord's pylons bobbing in `GameScene`.
- **A ship or building's look**: edit its mesh in `art/models.ts` (models face +x, in display
  pixels before `SHIP_ZOOM` 1.25 or the building zoom 1.35; Iron Dominion's ships also go through
  its `big` scale of 1.12,
  and its heavy a scale of 1.6; `bakeAll` then scales every faction's heavy to the battleship's
  reach, so all heavies are the same size and the biggest ships in the game). Give each class of a faction its own silhouette, not one ship at four sizes. Keep the faction's colour on a
  stripe or glow material, keep it distinct at phone size, and never a red cross. Check it with a
  sheet of the baked textures (`scene.textures.get(shipKey(f, type))`).
- **A contract**: add or change an entry in `CONTRACT_POOL` (with the step it is offered `from`).
  A new `Goal` needs counting in `World` (`score` for events, or a check in `updateContract`),
  any rule for when it can't be played in `contractOpen`, any setup in `startContract`, and a new
  perk field in `Perks` and `NO_PERKS` that a stat reads. Add it to `AI_GOALS` in `game/world.ts` if the rivals
  can play it too, with its counting in `dealScore` or `updateDeals`. `FIRST_CONTRACT` and the second board's
  `kills` card are part of the first round, so changing them means updating the playthrough.
- **A flagship**: its name and ability are `flagship` on each faction in `game/factions.ts`; its
  scaling is the `FLAGSHIP_*` constants in `game/world.ts`. Abilities on units go through
  `abilityOf`, so a new ability kind works on a flagship if its rule reads `abilityOf`.
- **A campaign sector**: add or change a row in `SECTORS`; the picker's strip spaces its nodes by
  `SECTOR_STRIP.nodeStep`, so more than five needs a new layout. The first sector stays the usual
  battle (16 loose nodes, nothing extra), or the seeded playthrough plays a different map.
- **New text in the scene**: a Phaser text draws its texture key from `Math.random`, so make any
  text that exists before the battle inside the `localRandom` swap at the end of `create`, or the
  seeded playthrough plays a different battle.
- **Beacon or salvage numbers**: the constants at the top of `game/world.ts`; the playthrough
  waits on the beacon paying 3 a second and a shard worth 8.
- **Sight and fog**: the vision constants at the top of `game/world.ts` and the fog's look at the
  top of `GameScene.ts`. Keep the beacon out of the hub's sight at the start (`HUB_VISION` below
  `BEACON_HOME_GAP` in `game/map.ts`): the playthrough asserts it starts hidden.
- **Nebula, veteran, repair, derelict or truce numbers**: the constants at the top of
  `game/world.ts`; the tooltips, labels and panel read them, so update the README's numbers. Keep
  nebulae and derelicts off the start-to-beacon lane (`NEBULA_LANE_GAP`, `DERELICT_LANE_GAP` in
  `game/map.ts`), so the playthrough's flight to the beacon stays in the open, and keep the map's
  `Math.random` draw count the same (retries use `localRandom`), or the seeded playthrough plays a
  different battle.
- **A new derelict kind**: add it to `DerelictKind` and `DERELICT_KINDS` in `game/map.ts` (the map
  places one of each), its name and text to `DERELICT_DEFS`, and its rule to `updateDerelict`,
  `updateCover`, `updateFog` or `train`.
- **A new rivals-panel action**: a method on `World` (so the AI could use it too), a `RivalButton`
  action in `GameScene.drawRivals` and its case in `onDown`.
- **Pathing numbers**: `ROCK_OVERLAP`, `ROUTE_MS`, `SPREAD`, `SPREAD_SPEED` and `REACH` at the top
  of `game/world.ts`, `PATH_CELL` in `game/pathing.ts`. A wing flies to the beacon and the
  playthrough's box selects the fresh wing, so check it still plays.
- **Research or expansion numbers**: `game/research.ts` and the expansion constants in
  `game/world.ts`; the tooltips read them, so update the README's numbers.
- **Anything the playthrough depends on** (button positions, the first-round numbers, the hub or
  harvester behaviour): change it in the same PR as its test update.
