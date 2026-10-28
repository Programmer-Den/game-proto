# Deadline: guide for agents

How Deadline is built and where it stands, for agents about to change it. `README.md` covers how to
play. Keep this file up to date with any change to the game, as the root `AGENTS.md` asks.

## Current state

Deadline is a portrait (540x960) wave defense game: a soldier at the bottom of a road fires volleys
straight up on a timer, and the player only moves them left and right. Zombies walk down and keep
to the middle of their lane, never chasing the soldier; upgrade crates drift down among them and are shot open for a stat upgrade, and
fuel drums roll down and blow up the zombies round them when shot. Bosses fight back and leave a
supply drop, and kills bank scrap that buys starting crates for the next run and lasting outpost
upgrades. A run is the endless Open Road or a 10-wave operation, picked on the game over screen.

- **Implemented:** endless waves that grow in size and toughness, runners from wave 2, brutes from
  wave 3, spitters (acid from range) and crawler swarms from wave 4, riot zombies (a shield only
  pierce, drums and flames get past) from wave 6, a boss at the end of every fifth wave with three
  telegraphed moves (charge, acid spit, a called pack), three bosses taking turns (the Behemoth, the
  Brood Mother who calls crawlers and bursts into more, the Bloater whose spit is huge and who
  leaves a huge acid pool when it falls), a supply drop after each boss
  (pick one of three: shotgun, flamethrower, medkit, sandbags), extraction (from wave 20 the supply
  drop also offers to end the run as a win, paying the run's scrap 2x and more for each boss wave
  passed up), sandbag crates from wave 2 and walls
  placed in a lane, scrap banked from kills and spent on the game over screen on starting crates for
  the next run, four crate upgrades (fire rate, damage, companion, pierce) and the perks their third
  crate evolves into (fire rounds, headshots, ricochets), survivors walking among the zombies from
  wave 3 (walking the seams between lanes; rifles hold fire on them, but pellets, marksman rounds and
  ricochets hurt them; one who reaches the sandbags joins the squad or gives scrap), wave
  conditions from wave 6 (blackout, blood moon, ammo shortage), the horde adapting from wave 8
  (every fourth grunt becomes armoured brutes, riot zombies or flank spitters, answering the
  squad's strongest stat), squad roles (a joining survivor picks Gunner, Grenadier or Marksman),
  outpost upgrades (Barricade, Field Medic, Fuel Depot, Veteran, three lasting levels each, bought
  with scrap), operations (Hospital and Lights Out: 10 waves under fixed rules, each with its own
  best and medal, picked on the game over screen beside the Open Road),
  a squad of up to eight companions in three staggered rows of three, fuel drums with a
  blast ring that previews how many zombies they would catch, a frenzy streak (12 quick kills
  double the fire rate for 5s), damage numbers on hits, a wave progress strip with a boss warning,
  a saved best wave, a HUD, a wave banner, health bars, a boss bar and a game over screen.
- **Two art styles**, switched live in game: a pulp horror comic (default) and a night-vision
  overwatch feed. All art is painted on 2D canvases in code (`src/art/`); there are no image files.
  The view takes the screen's shape on a phone or tablet (taller behind the squad, or wider
  shoulders round the road); on a desktop window wider than the game, a canvas behind it fills the
  sides with comic panels or an overwatch console.
- **Progression** within a run is the crates (and the perks three of a kind evolve into), the
  survivors who make it and the boss supply drops: no XP or levels. Stats reset on restart. Between
  runs, scrap (saved) buys starting crates, each kind once, spent at the next run's start, and
  outpost levels, kept for good. The Open Road has an ending: extraction, offered on every boss
  supply drop from wave 20; an operation ends as a win when its wave 10 is cleared.
- **Screens:** there is no title or menu. `BootScene` only starts `GameScene`, which bakes the
  textures it needs and begins wave 1 at once. The supply drop (phase `'supply'`), the role pick
  (phase `'role'`) and game over are overlays in the same scene; an extraction or a won operation
  ends in the same game over overlay with a win title (`state.extracted`). On game over a tap on a
  starting crate buys or refunds it, on an outpost upgrade buys its next level, on an operation
  picks it for the next run; any other tap calls `scene.restart()`. Taps count only once the
  screen has been up for `OVER_GRACE_MS` (600ms of game time, `overMs`), so a steering tap as the
  horde breaks through doesn't skip it.
- **Persistence:** the Open Road's best wave, the art style, the trophies earned, banked scrap, the starting crates
  bought for the next run, the outpost levels, the next operation and each operation's best (see
  Save keys). It also reads the hub's
  shared settings (the `hub-settings` key, see Hub settings below).
- **Rough edges seen in the code:**
  - No camera shake.
  - Each boss's moves cycle in a fixed order (each boss wave starts one further along).
  - A spitter stands still at its range until shot, so a wave can't end while one stands; it is
    an easy target once the soldier walks under it. Zombies steer to their lane's middle, inside
    `HERO.minX..HERO.maxX`, so none stops out of every rifle's reach.
  - Supply drop picks, kit panel items, squad roles and the operation are not shown in the
    wide-screen backdrop.
  - On a phone, where the game covers the screen, the shared corner buttons (full screen, sound,
    pause) sit over the kit panel's bottom-left corner.
  - Night-vision textures are baked the first time that style is shown, a hitch of about 0.4s
    (measured in headless Chromium) on that first switch; later switches take a frame or so. On a
    big screen the textures are painted finer, and the first switch takes about twice as long.
  - Drums are not blocked by anything and can overlap crates; their labels then overlap too.
  - The kit panel's last line runs past the panel when the perks and several supplies are all held
    (in English too, longer in German).
  - Zombies ignore survivors: nothing but the squad's fire can kill one, and a survivor walks
    through sandbag walls.
  - A boss wave can draw a condition too; a blackout hides the boss until it is close (its bar at
    the top still shows its health).

## Architecture

### File map

- `src/howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English, US English (the same with "armored", made by `us`) and German, picked with `byLanguage`
  and handed to `setupGame(game, { howToPlay })` in `src/main.ts`; update every language when the
  controls or the first round change.
- `src/i18n.ts` and `src/i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British
  English source, `i18n/de.ts` the German (with `keepEnglish` for the few that are the same) and
  `i18n/en-US.ts` only the texts spelled "armour", spelled "armor". `t(key, vars)` shows a text in
  the hub's language; `TextKey` types the keys. `GameScene.ts` and `Hud.ts` import it as `tr`, as
  `t` names Text objects there. Every text on screen goes through it, the backdrop's and the
  crate captions and comic sound words baked into textures included; a new one gets its German
  entry (and a US one if its spelling differs) in the same PR. Texts a style shows differently come
  in pairs: `key` for the comic and `nvKey` for night vision.
- `src/audio.ts`: the sound (`shared/audio.ts`): `SOUNDS` (the sound table), `sfx` (its `play`),
  `SoundName`, and the songs `SONG` and `BOSS_SONG`. See Sound below.
- `src/main.ts`: creates the `Phaser.Game` (size from `VIEW`, `Scale.FIT`, `pixelArt: false`) with
  `BootScene` and `GameScene`, calls `setupGame(game)` and `setupScaling(game, { fill: true })`, and exposes `game` on `window` in the dev
  build.
- `index.html`: the page; `#game` sits above the backdrop canvas (`z-index: 1`).
- `src/scenes/BootScene.ts`: scene `'Boot'`; starts `'Game'`.
- `src/scenes/GameScene.ts`: scene `'Game'`; all runtime logic: state, input, spawning, firing,
  movement, collisions, drums and blasts, riot shields, acid, boss moves and the three bosses,
  survivors, perks (burning, headshots, ricochets), wave conditions, sandbag walls, the
  flamethrower and medkit, the frenzy, effects, waves, the supply drop and extraction, style
  switching, bars, game over and its scrap shop.
- `src/scenes/Hud.ts`: `Hud` (top bar, style switch, progress strip, the wave condition's chip,
  frenzy meter, kit panel with the perks, the
  in-acid warning, drawn per style into one Graphics plus Text objects, redrawn only when its data
  changes), and the layout constants `STYLE_SWITCH`, `PROGRESS`, `CONDITION_CHIP`, `FRENZY_PANEL`,
  `KIT_PANEL`, `HUD_DEPTH`.
- `src/game/rules.ts`: pure numbers and rules (also `OUTPOST`, `OUTPOST_KINDS`, `OUTPOST_MAX`,
  `NO_OUTPOST`, `outpostCost`, `ROLES`, `ROLE_KINDS`, `GRENADE`, `MARKSMAN`, `OPERATIONS`,
  `OPERATION_KINDS`, `OPERATION_BONUS`, `MEDALS`, `medalOf`, `ADAPTS`, `ADAPT`, `adaptTo`,
  `WaveRules`; every `label`, `detail` and `name` in them is a `TextKey`): `VIEW`, `HERO`, `REACH_Y`, `SQUAD_SLOTS`,
  `MAX_COMPANIONS`, `ENEMIES`, `SCRAP`, `SPITTER`, `ACID_SLOW`, `riotShield`, `SWARM`,
  `swarmCount`, `BOSS`, `BOSS_MOVES`, `BOSSES`, `BOSS_KINDS`, `isBoss`, `bossKind`, `bossMove`,
  `BROOD`, `BLOATER`, `UPGRADES`, `PERKS`, `PERK_AT`, `perksOf`, `FIRE_ROUNDS`, `HEADSHOT`,
  `RICOCHET`, `SURVIVOR`, `CONDITIONS`, `CONDITION`, `drawCondition`, `EXTRACT`, `canExtract`,
  `CRATES` (upgrades plus `sandbag`),
  `SANDBAG_CRATE_ODDS`, `LANES`, `laneAt`, `laneMid`, `seamAt`, `WALL`, `SUPPLIES`, `supplyPick`, `SHOTGUN`, `FLAMER`,
  `MEDKIT`, `KIT_COSTS`, `PICKUP`, `DRUM`, `blastDamage`, `FRENZY`, `Stats`, `BASE_STATS`,
  `applyUpgrade`, `planWave`, `isBossWave`, `waveSize`, `waveTotal`, `waveToughness`, `toughness`, `drumCount`. No
  Phaser import; it imports only `byDifficulty` from `shared/settings.ts` and the `TextKey` type.
  `CONDITIONS` has no entry for `'clear'`, which shows nothing.
- `src/game/save.ts`: `loadBest`/`saveBest`, `loadStyle`/`saveStyle`, `loadScrap`/`saveScrap`,
  `loadKit`/`saveKit`, `loadOutpost`/`saveOutpost`, `loadOperation`/`saveOperation`,
  `loadOperationBests`/`saveOperationBests`, the `ArtStyle` type (`'comic' | 'nv'`) and the key
  names.
- `src/trophies/`: the game's ten trophies (`shared/trophies.ts`). `index.ts` lists them
  (`trophies`: id, tier, icon, `hidden` for Fortress) with their texts in `trophies/i18n/` (`en.ts`
  and `de.ts`: the name keyed by the id, what earns it by `<id>Text`), and imports nothing else from
  the game, since the hub loads it for its trophy shelf. `main.ts` hands `trophies` to `setupGame`,
  which lists them on the start and pause screens. `check.ts` holds each trophy's condition on the
  `GameState` (`EARNED`: the first wave cleared, a frenzy, a survivor saved, a perk, a boss
  beaten, `MAX_COMPANIONS` companions, an Open Road extraction, an operation won, every outpost
  upgrade at `OUTPOST_MAX`) and `checkTrophies(state)`, which `GameScene.update` calls at the start
  of every frame, game over included (the outpost is bought there), and again after the step, so a
  trophy is saved in the frame that earns it. Big bang (`DRUM_KILLS` 5 kills from one drum) is
  awarded by `checkBlast(killed)`, which `explode` calls for each drum. A new trophy is an entry in
  `index.ts`, its two texts in each language file and its condition in `EARNED`.
- `src/game/pool.ts`: generic `Pool<T>` with `take`, `release`, `live` and `all`, to reuse sprites.
- `src/art/paint.ts`: shared canvas tools (`bake`, `rng`, `circle`, `path`, colour helpers), `HI`
  (textures are painted at 2x on a screen that needs no scaling), `FULL_SCREEN` (layers painted at
  1x), `GEOM` (every sprite's box and origin, the same in both styles), `geomOf(name)` (a texture
  name's box), `GRAIN_TILE` and `tex(style, name)` (texture keys).
- `src/art/comic.ts`: `bakeComic` and the comic pen (`ink`: flat fill + halftone + ink outline,
  `dots`, `burst`, `letter`), reused by `backdrop.ts`.
- `src/art/nightvision.ts`: `bakeNightVision`; sprites are painted in greys, then `phosphor` maps
  them to green and blooms the brightest pixels; chemlights and amber brackets are painted after.
- `src/art/theme.ts`: `UPGRADE_COLORS`, `CRATE_COLORS` (adds the sandbag crate's tan),
  `ROLE_COLORS`, `OUTPOST_COLORS`, `OPERATION_COLORS`,
  `ACID_COLOR`, `SHIELD_COLOR`, `SURVIVOR_COLOR`, `BURN_COLOR` and the per-style `Theme` (fonts, text colours, accent,
  warning, hp bar) in `THEMES`. System font stacks only.
- `src/art/backdrop.ts`: `Backdrop`, the page canvas behind the game (comic panels or the overwatch
  console), and `BackdropInfo`, what the scene feeds it. Its canvas carries `data-backdrop` (and
  `aria-hidden`), which the hub test uses to tell it from the game's canvas.
- `shared/setupGame.ts` and `shared/settings.ts` (outside the game folder, shared by every game):
  the hub's settings, applied in `src/main.ts`, read for difficulty in `src/game/rules.ts` and for
  reduced motion in `src/scenes/GameScene.ts`. `shared/i18n.ts` (`translator`, `byLanguage`,
  `formatNumber`, `Translation`) for the language; the fire rate is shown with `fireRate` in `Hud.ts`
  (2.9 or 2,9).

### How it runs

- **Textures:** keys are `<style>-<name>` (`tex`), e.g. `comic-grunt`, `nv-crate-rate`. Names:
  `ground`, `sandbags`, `hero`, `companion`, `grunt`, `runner`, `brute`, `boss`, `crate-<kind>`,
  `label-<kind>` (the crate's caption), `drum`, `ring` (the drum's blast ring), `bullet`, `muzzle`,
  `splat`, `blast`, `streak`, `hudbar`, `spitter`, `riot`, `riot-bare` (its shield broken),
  `crawler`, `brood`, `bloater`, `survivor`, `acid` (a puddle, painted for radius 78 and scaled), `glob`, `wall` (painted for the
  middle lane and stretched to the others), `flame`, `supply-<kind>` (the supply drop's icons)
  and `supply-extract` (the extraction card's flare),
  plus `sfx-blam`, `sfx-splut`, `sfx-boom` (comic only) and `scan`, `grain` (night vision only). Enemy sprites use the `EnemyKind` as the name. `create`
  bakes the saved style; `switchStyle` bakes the other one the first time.
- **Skins:** `GameScene.skin(img, name)` sets an image's texture for the current style, its origin
  from `GEOM` (by the name's first part: `crate-rate` uses `GEOM.crate`) and its scale from the
  texture's size, and records the image in `skins`. `applyStyle` re-textures every recorded image,
  restyles Text objects, moves the drum rings and marks between their comic and night-vision depths,
  shows or hides the night-vision overlay (`scan` image and `grain` tile sprite), clears effects,
  rebuilds the game over overlay if it is up, and tells the `Hud` and `Backdrop`.
- **Tick:** `GameScene.update` clamps `delta` to 100ms, runs `animateFeed` (grain and flicker),
  and unless the phase is `'over'`, `'supply'` or `'role'` (everything holds still then) runs in order:
  `moveHero`, `spawn`, `fire`, `moveBullets`, `tickBoss`, `moveEnemies` (stops the frame on game
  over; also ticks the burn of fire rounds), `movePickups`, `moveDrums`, `moveAcid`, `moveWalls`,
  `moveSurvivors`, `hitTargets`, `tickFlamer`,
  `tickFrenzy`, `ageEffects`, `checkWave`, `drawBars`, `updateHud`, and once per game second
  `refreshBackdrop`. All timing is accumulated `dt` in private clocks (`waveClock`, `fireClock`,
  `breakClock`, `sinceKill`, `runMs`, effect and splat ages); no Phaser timers drive gameplay.
  Tweens only fade the banner and the upgrade pop-up text.
- **Waves:** `startWave` draws `state.condition = drawCondition(wave)` (from wave 6; an operation
  with a fixed `condition` takes that instead and draws nothing), sets `state.adapt =
  adaptTo(stats)` from `ADAPT.fromWave`, then sets `plan = planWave(wave, Math.random, condition,
  rules)` (`WaveRules`: the Fuel Depot's `extraDrums`, the operation's `drums`, `survivors` and
  `survivorsFrom`, and `adapt`), a list of `Spawn`s (enemy, pickup, drum or
  survivor) sorted by `at`, resets `fallen` and `waveTotal` (`waveTotal(wave)`: its zombies plus
  its boss), sets `state.bossKind` (`bossKind(wave)` on a boss wave), and saves a new best. The
  banner names the boss and the condition, and `applyCondition` shows the blackout's dark rectangle
  (`dark`, under the enemies) or the blood moon's red cast (`moon`, over the road). `spawn` shifts entries off the front once `waveClock` passes their `at`.
  `checkWave` moves to `'break'` when `enemiesToCome()` is 0 and no enemy is live (crates and drums
  do not count) and saves the bank plus this run's scrap; after a boss wave it moves to `'supply'`
  instead, with `offer = supplyPick(shotgunMaxed)` (no shotgun card once `pellets` is at `SHOTGUN.maxPairs`), and `pickSupply` (a card tap or 1/2/3) moves on to
  `'break'`. After `BREAK_MS` it calls `startWave(wave + 1)`. Crawler swarms are ordinary enemy
  spawns in the plan; `waveTotal` counts them, and `callPack` adds a boss's pack to
  `state.waveTotal` during the wave.
- **New zombies:** a spitter walks to `SPITTER.standY`, stops, and every `SPITTER.everyMs` calls
  `lobAcid` at the hero's x. A riot zombie spawns with `shield = riotShield(wave)`; in
  `hitTargets` a bullet without pierce (`b.pierces`) hits the shield instead (`chipShield`), which
  re-skins it as `riot-bare` at 0. Drum blasts and flames call `hurt` directly, past the shield.
- **Acid:** `lobAcid` takes an `Acid` from the `acids` pool: a glob arcs from the thrower to the
  hero's line over `flight` ms (its target ring drawn in `drawBars`), then a puddle burns for
  `life` ms. `moveAcid` sets `state.inAcid` when the hero's x is inside a landed puddle, and `fire`
  then multiplies the interval by `ACID_SLOW`.
- **Boss moves:** `tickBoss` finds the live boss (`isBoss(kind)`: `boss`, `brood` or `bloater`),
  counts `bossClock` to `BOSS.firstMs` (then `everyMs`), picks
  `bossMove(wave, bossMoves)` from that boss's own round (`BOSSES[kind].moves`) and aims at the
  hero's x (`bossAct`), shows `bossCall` text and the
  warning (arrow, ring or circle, in `drawBars`) for `BOSS.warnMs`, then charges (moving the boss
  itself over `chargeMs`; `moveEnemies` doesn't move a busy boss), lobs a big acid pool
  (`spitRadius(kind)`: the Bloater's is `BLOATER.spitRadius`) or calls
  the pack (`callPack`: `BOSS.pack` runners, or `BROOD.pack` crawlers for the Brood Mother, placed
  by `spawnPack`, which adds them to `waveTotal`, puts them above the boss instead of below it once
  the boss is within `FLAMER.trigger` of `REACH_Y`, and keeps them at least `PACK_CLEAR` above the
  sandbags, so a boss at the line can't put a pack behind them or right on them). A medkit push ends a charge. In `kill`, a
  Brood Mother bursts into `BROOD.burst` crawlers (`spawnPack` again) and a Bloater lobs a
  `BLOATER.poolRadius` acid pool at the hero's x that burns for `BLOATER.poolMs`; the boss is
  released to its pool only after that, since `Pool.take` hands out the last released object and
  the burst would otherwise reuse (and move) the boss's own `Enemy`.
- **Perks:** `collected` counts every crate of a kind (the starting kit included, counted in
  `create`); `perksOf(collected)` lists the perks at `PERK_AT` or more, kept in `state.perks`
  (`collect` shows a banner for a new one). In `hitTargets`, with `fire` every bullet hit sets
  `e.burn = FIRE_ROUNDS.ms` and `moveEnemies` ticks `FIRE_ROUNDS.damage(wave)` every `tickMs`
  (past shields, drawn as a flame in `drawBars`); with `headshot` every `HEADSHOT.every`th bullet
  hit on a zombie (`bulletHits`) does `HEADSHOT.mult` times the damage and counts in
  `state.headshots`; with `ricochet` a bullet whose hits ran out on a zombie (`b.ricochets` set by
  `fire`) is re-aimed from that zombie at `nearestEnemy` within `RICOCHET.range` with one more hit.
- **Lanes, not the hero:** `moveEnemies` steers each zombie (not a flank spitter) towards
  `laneMid(laneAt(e.x))` plus a small per-id offset, at its `ENEMIES[kind].steer`: the horde goes
  for its lane's sandbags in three crowded columns and never homes in on the hero.
- **Survivors:** a `survivor` spawn takes one from the `survivors` pool (sprite plus a label
  Text). `moveSurvivors` walks it down at `SURVIVOR.speed`, steering towards `seamAt(v.x)` (the
  nearest boundary between two lanes, out of the horde's columns), and calls `rescue` at the
  sandbags: a companion (`applyUpgrade(stats, 'companion')`,
  `addCompanions`) or `SURVIVOR.scrap` once the squad is full; `state.survivorsSaved` counts them.
  In `fire` a rifle's straight shot is held while `survivorAhead(x, y)` (a survivor up its column);
  shotgun pellets, a marksman's aimed round and ricochets are not held. `hitTargets` sweeps
  survivors along with the enemies, so the nearest thing in a bullet's path is hit first;
  `hurtSurvivor` takes the damage and at 0 the survivor is lost (`state.survivorsLost`).
  They don't count towards `waveTotal` or block a wave clear, and keep walking in the break.
- **Conditions:** `state.condition` is read where it applies: `fire` multiplies the interval by
  `CONDITION.shortageFire` in a shortage (and `planWave` got `CONDITION.shortageDrums` more drums
  through `drumCount`), `moveEnemies` multiplies a runner's speed by `CONDITION.bloodMoonRunner`
  under a blood moon, and in a blackout `visibility(x, y)` (0 beyond `CONDITION.blackoutRadius`
  of the hero, fading in over 70px) sets every enemy's and survivor's alpha and hides the bars
  of those out of sight. The `Hud` shows the condition on a chip under the progress strip.
- **The horde adapts:** `adaptTo(stats)` scores pierce (its level), fire rate (rate crates in
  `fireInterval`) and the squad (companions / 2) and picks the highest at `ADAPT.minScore` or more.
  `planWave` then turns every `ADAPT.every`th grunt into a brute with `armoured`, a riot zombie,
  or a spitter with `flank` at a road edge, with no extra draws. In `hitTargets` an `armoured`
  enemy ends the bullet (no pierce on, no ricochet) and `drawBars` paints its plate; a `flank`
  spitter doesn't steer in `moveEnemies`. The banner and the condition chip name it.
- **Squad roles:** `state.roles` holds each companion's `Role`, in `squad` order; `addCompanions`
  fills any missing ones as Gunners. `rescue` (squad not full) saves the phase in `rolePrev` and
  moves to `'role'`, and `update` stops that frame right after `moveSurvivors`, so no crate opened
  by the frame's bullets fills the squad under the pick; `showRoles` draws three cards (`roleCards`, keys 1/2/3) and `pickRole` adds
  the companion with that role and goes back to `rolePrev`. While the pick is up, `moveSurvivors`
  holds every other survivor. In `fire` a marksman only shoots every `MARKSMAN.every`th volley, at
  `toughestEnemy` (a bullet with `mult` and extra pierce), a grenadier's every `GRENADE.every`th
  bullet is a `grenade`, which bursts on the first zombie it hits (`grenade(x, y)`: every zombie
  within `GRENADE.radius` past shields). `drawBars` badges grenadiers and marksmen.
- **Outpost:** `state.outpost` (saved under `deadline-outpost`) is applied in `create`: Barricade
  levels as `sandbags`, Field Medic as `medkits`, Veteran as companions (Gunners); the Fuel Depot
  goes to `planWave` as `extraDrums`. `buyOutpost` buys the next level at `outpostCost`.
- **Operations:** `state.operation` (read from `deadline-operation` in `create`) sets the wave
  rules from `OPERATIONS`; `pickOperation` sets `state.nextOperation` and saves it, so the choice
  sticks. In an operation `state.best` is its best (waves cleared, from `deadline-operation-best`),
  `deadline-best` is left alone, and `checkWave` calls `recordOperation` on each clear and
  `completeOperation` (`endAsWin` with `OPERATION_BONUS`) once the last wave is cleared, in place of
  its supply drop. `medalOf(cleared)` gives the medal. The HUD's best chip shows the operation.
- **Extraction:** `showSupply` adds a fourth, wide card when `canExtract(wave)` (a boss wave from
  `EXTRACT.fromWave`), tapped or taken with 4; `pickSupply('extract')` calls `extract`, which
  sets `state.extracted`, pays `state.payout = round(scrap * EXTRACT.bonus(wave))` into the bank
  (saved) and shows the game over overlay with a win title.
- **Sandbag walls:** a `sandbag` crate adds to `state.sandbags`. A tap on `Hud.onKit` toggles
  `state.placing`; the next tap on the road calls `placeWall(laneAt(x))` (the S key places in the
  hero's lane). Both only work in the `'wave'` phase, since a wall placed in the break would run
  out before the next wave arrives. Walls are a `walls` pool, one per lane, at `WALL.y` for `WALL.ms`; `moveEnemies`
  stops non-boss zombies in that lane just above it, and a boss calls `smashWall`.
- **Supplies:** `state.pellets` adds bullet pairs to the hero's slot in `fire` (`SHOTGUN.angle`
  apart, with `vx`; hits are swept along the bullet's whole move). `tickFlamer` spends a flame
  when a zombie is within `FLAMER.trigger` of `REACH_Y` and hurts every zombie within
  `FLAMER.reach`. In `moveEnemies` a zombie at the line spends a medkit (`useMedkit`) instead of
  ending the game.
- **Scrap:** `kill` adds `SCRAP[kind]` to `state.scrap`. `gameOver` adds it to `state.bank` and
  saves it (a win adds the payout instead); `showGameOver` draws the shop, the outpost and the
  operation picker (`shop` tap boxes, each with its `act`) and `buyKit` buys or refunds a
  starting crate into `state.nextKit` (saved as `deadline-kit`). `create` applies the saved kit to
  the starting stats (`state.startKit`) and clears it.
- **Drums:** `moveDrums` rolls each drum down at `DRUM.speed`, counts the zombies within
  `DRUM.blastRadius` (`caught`, and flags them `inBlast` for the marks drawn in `drawBars`), and
  updates its ring and label. In `hitTargets`, a bullet that still has hits left after the enemies
  tests drums and then crates (square boxes); a drum at 0 hp calls `explode`, which runs `hurt`
  with `blastDamage(wave)` on every zombie in the ring and records `lastBlast`. A drum past the
  sandbags is lost.
- **Frenzy:** `kill` adds to `streak` when the last kill was within `FRENZY.gapMs` (or a frenzy is
  running), else starts it at 1. At `FRENZY.kills` it sets `frenzyMs = FRENZY.ms`; `fire` divides
  the fire interval by `FRENZY.rate` while it runs. `tickFrenzy` counts it down (the streak resets
  when it ends) and breaks the streak after `gapMs` without a kill. Every third streak kill pops a
  `streak` burst; every hit pops a `-N` number (`hurt`).
- **Effects:** one `fx` pool of image + text pairs (`effect`, aged in `ageEffects`): muzzle flashes,
  blasts, lettered sounds (comic only: BLAM! every `BLAM_EVERY` volleys, SPLUT! every `SPLUT_EVERY`
  kills, KA-BOOM! on a blast), streak bursts and hit numbers. No `Math.random` in any of them.
- **Squad:** `stats.companions` companions stand at `SQUAD_SLOTS[1..]`, offsets from the hero
  (`SQUAD_SLOTS[0]`): the front row beside the hero, then two rows behind it, 24px apart, each row
  shifted 20px so all nine rifles are in different columns 20px apart. `collect` calls
  `addCompanions`, which makes the `squad` images; `moveHero` places them every frame and `fire`
  sends one bullet from each slot (from its own row's y). Depth grows with the row, so back rows draw
  on top. `heroRange()` narrows the hero's x range so every squad rifle stays in
  `HERO.minX..HERO.maxX`. Once the squad is full (`MAX_COMPANIONS` = 8), `spawn` turns a companion
  crate into a damage crate, and `collect` does the same for a companion crate that was already
  falling when the squad filled; `applyUpgrade` also caps the count.
- **Input:** a `pointerdown` inside `Hud.onSwitch` (the `STYLE_SWITCH` box, padded 6px) calls
  `switchStyle` and nothing else; the V key does the same. In `'over'` it runs a `shop` button's
  `act` or restarts, in `'supply'` it picks a card (1, 2, 3, or 4 for the extraction card), in
  `'role'` a role card (1, 2, 3), on the kit panel it toggles placing (outside a wave, or in a
  wave with no sandbags, it only plays `ui('refuse')` and never aims; `Hud.onKit` is false while
  the panel is hidden, `kitShown`, so a tap there then aims as anywhere else), and while placing it places a wall. Otherwise `createInput` sets `pointerTarget` (clamped to `heroRange()`) on
  `pointerdown`, and on `pointermove` while held (unless the press was used by any of the above:
  `pressOnUi`). `moveHero` walks towards it at `HERO.speed` and clears it
  on arrival; it re-clamps `pointerTarget` to `heroRange()` first, since a new companion can narrow
  it. Held A/D or arrow keys move directly and clear `pointerTarget`. A tap in the `'over'` phase
  restarts the scene instead (after `OVER_GRACE_MS`). Phaser's keyboard plugin destroys its keys
  on shutdown, so `createInput`'s key listeners don't pile up over restarts.
- **Rendering:** objects are long-lived and updated in place: pooled images for enemies, crates
  (with a label image and an hp Text), drums (with a ring image and a label Text), bullets, splats
  and effects are repositioned each frame and hidden on release. `bars` (health bars, drum label
  balloons or tags, the boss bar) and `marks` (marks on zombies in a blast ring) are Graphics
  redrawn every frame; in the comic `marks` sit on the road under the horde, in night vision both
  are part of the overlay above the scanlines (`DEPTH.labels`). Enemy depth is
  `DEPTH.enemies + y / VIEW.h` so lower zombies draw on top.
- **Backdrop:** `GameScene.backdrop` is one `Backdrop` for the page's lifetime (static, so restarts
  keep it). It finds the game's frame from `game.canvas`, paints each side in a 656x1080 design box
  scaled to fit, caches the still parts per style and size, and repaints its live parts (captions,
  REC clock, horde count, roster, supply drops, stats) on `refresh`. Sides narrower than 140px
  are left plain, so at the test's 540x960 nothing shows.

### Sound

All sound is made in code by `shared/audio.ts`; `GameScene` plays it, and nothing in `src/game/`
imports it. Under browser automation it all does nothing, so the playthrough is unchanged.

- **Music:** `SONG` (E Phrygian, 140 BPM, square lead, thin pulse arpeggio, triangle bass, drums)
  has the parts `calm` (a pad, no beat: breaks, supply drop, game over), `battle` (a wave),
  `frenzy` (the battle with double hats and a 16th arpeggio, while `frenzyMs` runs) and `dark`
  (low half steps and a sparse beat, a wave under a blackout or blood moon), and the stings `warn`
  (a low horn as a boss wave starts), `lose` (game over) and `win` (extraction or a won
  operation). `BOSS_SONG` (150 BPM, heavier, with the diminished fifth) plays its `boss` part
  through every boss wave. `GameScene.music()` picks the part from the phase and is called from
  `startWave`, `checkWave`, `pickSupply`, the frenzy's start (`kill`) and end (`tickFrenzy`); the
  role pick leaves the music as it is. `gameOver` and `endAsWin` switch to `calm` under their sting,
  and a restart's `startWave(1)` goes back to `battle`.
- **Effects** (`SOUNDS`, played with `sfx(name)`): `shot` once per volley (`fire`), `hit` once per
  `hitTargets` pass when any bullet hurt a zombie that lives and can be seen (not per pellet, and
  not for burn ticks, flames, grenades or blasts, which have their own sounds), `block` (once per
  `hitTargets` pass when a shield the player can see held a bullet), `shieldDown` (`chipShield`,
  only when the shield can be seen), `ricochet` (once per `hitTargets` pass, for a ricochet off a
  zombie that can be seen), `kill` pitched by kind with `KILL_PITCH` and
  `bossKill` (`kill`, only when the zombie can be seen in a blackout), `frenzy` (`kill`), `boom` (`explode`), `grenade` (`grenade`), `flame`
  (`tickFlamer`), `crate` and `perk` (`collect`), `wall` (`placeWall`) and `wallSmash`
  (`smashWall`), `spit` (`lobAcid`, only when the thrower can be seen in a blackout) and `sizzle`
  (the glob lands, `moveAcid`), `siren` (a boss winds up, `tickBoss`), `yelp` and `survivorLost`
  (`hurtSurvivor`), `rescue` (`rescue`), `medkit` (`useMedkit`), `waveStart` (`startWave`, from
  wave 2, not on boss waves), `cleared` and `supply` (`checkWave`), `confirm` (`pickSupply`,
  `pickRole`).
- **Shared sounds:** `ui('click')` for the style switch, the kit panel toggle, putting the
  sandbags away, refunding a starting crate, picking an operation and the restart tap;
  `ui('coin')` for buying a starting crate or an outpost level; `ui('refuse')` for one that can't
  be afforded, for S with no sandbags in a wave (`placeWall` returns whether it placed) and for a
  tap on the kit panel outside a wave or with no sandbags.
- There is no `?watch` mode, so nothing for it.

### Save keys

- `deadline-best`: the highest wave any run has reached, a number. Written by `startWave` when the
  wave beats `state.best`. A broken value loads as 0.
- `deadline-style`: `'comic'` or `'nv'`. Written by `switchStyle`; anything else loads as the
  comic.
- `deadline-scrap`: banked scrap, a number. Written at each wave clear (bank plus this run's
  scrap), at game over and on each shop purchase or refund. A broken value loads as 0.
- `deadline-kit`: a JSON array of `UpgradeKind`s bought for the next run. Written by `buyKit`,
  read and removed by `create`; unknown kinds are dropped.
- `deadline-outpost`: a JSON object of `OutpostKind` levels (0 to 3). Written by `buyOutpost`;
  missing or broken levels load as 0.
- `deadline-operation`: the `OperationKind` the next run plays. Written by `pickOperation`, read
  (and kept) by `create`; anything unknown loads as `'road'`.
- `deadline-operation-best`: a JSON object of each operation's most waves cleared. Written by
  `recordOperation`.
- All are read and written through `src/game/save.ts`, wrapped in try/catch.
- `deadline-trophies`: the trophies earned (`shared/trophies.ts`, not `save.ts`), each id with the
  time.

### Hub settings

- `src/main.ts` calls `setupGame(game)` from `shared/setupGame.ts` right after creating the game.
  It applies the frame cap, the FPS readout, reduced motion and full screen (camera shake and flash become
  no-ops; Deadline uses neither).
- Difficulty scales one number: enemy toughness in `planWave` in `src/game/rules.ts`, multiplied
  by `byDifficulty(0.75, 1, 1.3)` (easy, normal, hard). It applies to every enemy's hp, the boss
  included, but not to crate hp, drum hp, blast damage or fire rounds' burn (`FIRE_ROUNDS.damage`
  uses `waveToughness`, the wave's toughness before difficulty).
- `settings.reduceMotion` stops the zombies' side-to-side sway in `GameScene.moveEnemies` (they
  still walk and steer), holds the night-vision grain, scanline and flicker still (`animateFeed`
  does nothing), and makes a drum's blast show at full size instead of swelling and a flame burst
  stay its size. There is no shake, screen flash or blinking effect; the boss's warnings and acid
  rings are drawn still.
- Normal (multiplier 1) must stay exactly as designed, since the playthrough runs on Normal.
- Keep the Deadline row of the difficulty table in the root `README.md` (and the sentence in this
  game's `README.md`) in sync: zombies have 25% less health on Easy and 30% more on Hard.
- The settings live under the shared `hub-settings` storage key, not in a save of this game, and
  are read once when the page loads (`settings` in `shared/settings.ts`), so `scene.restart()`
  keeps them.

### State model

- `GameState` (exported from `GameScene.ts`): `wave`, `phase` (`'wave' | 'break' | 'supply' | 'role' | 'over'`),
  `kills`, `stats` (a `Stats` from `rules.ts`: `damage`, `fireInterval`, `companions`, `pierce`),
  `collected` (count per `UpgradeKind`), `best`, `fallen` and `waveTotal` (the progress strip),
  `streak`, `frenzyMs` and `frenzies`, `drumsBlown` and `lastBlast` (`{ caught, killed }` of the
  last drum), `scrap` (this run) and `bank` (saved before it), `startKit` and `nextKit`,
  `sandbags`, `placing` and `walls` (placed this run), `pellets`, `flames` and `medkits`, `offer`
  and `supplies` (picked this run), `inAcid`, `bossMove`, `bossMoves` and `bossKind`, `perks` and
  `headshots`, `survivorsSaved` and `survivorsLost`, `condition`, `extracted` and `payout`,
  `outpost`, `roles`, `operation`, `nextOperation`, `operationBests` and `adapt`. The
  scene's public `squad` holds the companion images, one per `stats.companions`,
  and `style` the current `ArtStyle`.
- Entities (`Enemy`, `Survivor`, `Pickup`, `Drum`, `Bullet`, `Acid`, `Wall`, `Splat`, `Fx`) are private interfaces in
  `GameScene.ts`, held in `Pool`s, not in `GameState`. Each has `alive`; enemies, survivors, pickups and drums
  share the `id` counter `nextId` so a bullet's `hit` list can hold all of them.
- Mutation: the scene mutates everything. The only pure function on state is `applyUpgrade`, which
  returns a new `Stats` (called from `collect`). `planWave` is pure given its `rand`.
- Invariants: `player.x` is always in `heroRange()` (inside `HERO.minX..HERO.maxX`), and it is the
  rifle's x, not the sprite's centre (the soldier's `GEOM` origin is the rifle). A bullet's
  `hitsLeft` starts at `1 + pierce` and is spent on enemies and survivors first, then drums, then
  crates, in the same frame (a ricochet gives it one more hit and skips the drums and crates that
  frame). `fallen` counts every kill of the wave, drum kills included, so it equals `kills`
  during wave 1. Wave 1 is all grunts.
- Game over: `moveEnemies` calls `gameOver` as soon as any enemy's `y + radius >= REACH_Y`, and
  the rest of that frame is skipped.

### Randomness and timing

- `Math.random` is used only by `planWave`, `drawCondition` and `supplyPick` (their default
  `rand`). The horde adapting draws nothing; an operation's extra survivors draw after the first
  one's, and its fixed condition skips the condition's draw. `startWave` calls `drawCondition` (one draw, from wave 6 only) before `planWave`. The order of
  `rand()` calls in `planWave` (per enemy: kind roll then x; then per crate: upgrade then x; then
  per drum: x; then per crawler swarm: x; then, from wave 2, the sandbag crate roll and its time
  and x; then, from wave 3, the survivor's time and x) fixes what the seeded test sees. Newer draws
  come last and only on the waves that have them, so wave 1's draws are unchanged. The new kinds reuse the one kind roll (spitter 0.4-0.5
  from wave 4, riot 0.5-0.6 from wave 6).
- The art uses its own seeded `rng` (`paint.ts`), so it looks the same every run. Effects, the
  BLAM! placement and the night-vision flicker come from counters and the frame number.
- No `Date.now`, `performance.now` or `setTimeout` in `src/`; game time is Phaser's `delta` only.
  The backdrop repaints on window resize through `requestAnimationFrame`, which touches no game
  state.
- Enemy sway and spread are derived from `id` and `y`, not random, so they are frame-rate stable.

### Data tables

- All tuning is in `src/game/rules.ts`: hero line and speed (`HERO`), `REACH_Y`, `BULLET`,
  `BREAK_MS`, the squad formation (`SQUAD_SLOTS`, `MAX_COMPANIONS`), enemy hp/speed/steer/radius
  (`ENEMIES`), crate speed and size (`PICKUP`), drum speed, size, blast radius and hp (`DRUM`:
  30px/s, 88px, one hit), `blastDamage` (`6 + 3 * wave`), the frenzy (`FRENZY`: 1500ms gap, 12
  kills, 5000ms, 2x), starting stats (`BASE_STATS`), `MIN_FIRE_INTERVAL`, the upgrade effects
  (`applyUpgrade`), the perks (`PERK_AT`, `FIRE_ROUNDS`, `HEADSHOT`, `RICOCHET`), the new zombies
  (`SPITTER`, `riotShield`, `SWARM`), the bosses (`BOSS`, `BOSSES`, `BROOD`, `BLOATER`),
  survivors (`SURVIVOR`), conditions (`CONDITION`), extraction (`EXTRACT`: from wave 20, bonus
  `2 + (wave - 20) / 10`), walls
  (`WALL`, `LANES`), supplies (`SHOTGUN`, `FLAMER`, `MEDKIT`), scrap (`SCRAP`, `KIT_COSTS`), and
  wave growth in `waveSize` and `planWave` (toughness `1 + 0.3 * (wave - 1)`
  times the difficulty multiplier, spawn gap, kind odds, boss delay, crate count
  `1 + floor(wave / 3)`, crate hp `10 + 6 * wave`, drum count `1 + floor(wave / 4)` from 2000ms,
  plus 2 in an ammo shortage).
- Visual-only constants stay in `GameScene.ts` (`DEPTH`, `SPLAT_MS`, `BLAM_EVERY`,
  `SPLUT_EVERY`, and the game over screen's `OVER_GRACE_MS`), `Hud.ts` (layout) and `src/art/` (colours, `GEOM`).

## Testing hooks

- `src/main.ts` puts `game` on `window` when `import.meta.env.DEV`. The test reads
  `window.game.scene.getScene('Game')` and from it `state` (deep-copied), `player.x`/`player.y`,
  `pointerTarget !== null` (as "moving"), `style`, `liveEnemies()`, `livePickups()` and
  `liveDrums()` (`id`, `hp`, `maxHp`, `x`, `y`, `caught`), and `localStorage` (`deadline-best`,
  `deadline-style`, `deadline-scrap`). `liveEnemies()` also gives `shield`, `armoured` and `flank`; `liveAcid()`,
  `liveWalls()` and `liveSurvivors()` exist for checks by hand.
- Inputs: only mouse clicks on the game's canvas (`#game canvas`; the page has a second canvas
  behind it), converted from game pixels with its bounding box. The Playwright project `deadline`
  uses a 540x960 viewport.
- The test seeds `Math.random`, owns the clock (64ms frames), and forces the canvas renderer.
- The test reads no text, so it plays the same in any language; it runs in British English, the
  default (the hub's Language setting picks the language, not the browser's).
- Flow: wave 1 starts with `BASE_STATS`, best 1 (saved), no scrap, starting kit or sandbags, the
  hero at `VIEW.w / 2` and the comic style; it taps the switch's NV half (style `nv`, saved, hero not moving, screenshot
  `0-night-vision`) and its COMIC half (back to `comic`); at least 3 grunts come in; it taps above the lowest
  enemy (zombies keep to their lanes, so the hero has to move) until a first kill (`fallen` equals `kills`, a streak started, `scrap` equals `kills`); the wave's drum comes in, and it plays on aiming at
  the front zombie until the drum's ring has caught a zombie while the front is above
  `FRONT_SAFE_Y`, then taps below the drum and waits for `drumsBlown` 1 (the blast caught some,
  killed all it caught, `fallen` equals `kills`, the streak counts the blast's kills); then the
  first crate: it taps above it and waits to open it, checking `collected` and `stats`; it taps
  above the lowest enemy until the phase is `'break'` with 12 kills and `fallen` 12 of 12, 12 scrap
  and `deadline-scrap` saved as 12, and `deadline-trophies` holding only `firstWave` (First night); then wave
  2 starts with best 2 saved and `fallen` 0, and the streak breaks.
- Kept in sync by hand in `e2e/playthrough.spec.ts`: `VIEW`, `HERO_Y = 880`,
  `WAVE_1_ENEMIES = 12` (from `waveSize(1)`), `GRUNT_SCRAP` (`SCRAP.grunt`), `BASE_STATS`, `UPGRADED` (each upgrade applied once
  to the base stats, e.g. fire interval 272 or one companion), `SWITCH` (the two halves of
  `STYLE_SWITCH`), `STREAK_GAP_MS` (`FRENZY.gapMs`) and `FRONT_SAFE_Y`. Changing those, the
  `GameState` shape, the scene key `'Game'`, the public fields above, `planWave`'s random draws
  for wave 1, the drum's timing, speed, radius or one-hit hp, or the wave-1 blast damage means
  updating the test in the same PR, and refreshing `docs/screenshots/playthrough-*.webp`.
- The test runs on Normal difficulty (no `hub-settings` saved), so enemy hp is unscaled. It
  starts from a fresh save, so the outpost is at 0 and the run is the Open Road: wave 1 has no
  survivors, roles or adapting, and its plan is unchanged.
- Balance matters: the test needs wave 1 to be winnable by its simple strategy within the game time
  it allows, and the wave-1 drum to catch a zombie while the front is far enough away; slower
  firing, tougher wave 1 grunts or a later drum can turn it red.

## Making common changes

- **Add or change a text:** its key in `src/i18n/en.ts`, the German in `src/i18n/de.ts` (the build
  fails without it) and, when it spells "armour", the US spelling in `src/i18n/en-US.ts`; run
  `node scripts/check-translations.mjs`. German runs longer than English: the HUD's stats row, the
  progress strip's boss note, the frenzy meter, the game over buttons and the operation cards are
  the tightest spots, so check a new text with `?lang=de`. The wave banner wraps and supply and
  role card names shrink to fit (`fit`), but nothing else does.

- **Tune a number:** edit `src/game/rules.ts`. If it touches wave 1, `BASE_STATS`, an upgrade's
  effect, drums or the frenzy gap, update the mirrored constants in the test.
- **Add an enemy kind:** add it to `EnemyKind`, `ENEMIES` and `SCRAP` in `rules.ts`, add its odds
  in `planWave` (on the existing kind roll, or with new draws after the others), a box in `GEOM` (`paint.ts`), and paint it in both `bakeComic` and
  `bakeNightVision` under the same name. Give it a splat scale in `GameScene.kill` if it is big.
- **Add a sprite:** give it a `GEOM` entry and bake it in both styles (or guard its use on the
  style, like the comic's `sfx-*`; `effect` skips a texture that doesn't exist). Show it through
  `skin` so a style switch swaps it.
- **Change the art of one style:** edit `comic.ts` or `nightvision.ts`; keep each sprite inside its
  `GEOM` box with the origin where the entity's x, y is (the soldier's is the rifle).
- **Change the squad's shape:** edit `SQUAD_SLOTS` in `rules.ts` (`MAX_COMPANIONS` follows its
  length). Keep every slot's `dx` distinct so no rifle is behind another, and the back row's `dy`
  small enough that its sprite stays above `VIEW.h`.
- **Add an upgrade:** add it to `UpgradeKind` and `UPGRADES`, a case in `applyUpgrade` (and a
  `Stats` field plus use in `GameScene.fire` or `hitTargets` if it is a new stat), a colour in
  `UPGRADE_COLORS` (`theme.ts`; both crate textures and labels bake from it), a stat in
  `Hud.stats` and a row in the backdrop's supply list. Adding a kind changes
  `UPGRADE_KINDS.length`, so the seeded first crate may change: update `UPGRADED` in the test and
  recheck it.
- **Change wave makeup or bosses:** edit `planWave`, `waveSize` and `isBossWave`. Keep the spawn
  list sorted by `at`, since `spawn` only looks at the front.
- **Add a HUD item:** add it to `HudData` and draw it in both `drawComic` and `drawNv` in
  `Hud.ts`; keep clear of `STYLE_SWITCH`, or move the switch and the test's `SWITCH`.
- **Add a supply:** add it to `SupplyKind` and `SUPPLIES`, apply it in `pickSupply`, paint
  `supply-<kind>` in both styles, and show it in `Hud.drawKit` if it is held.
- **Add a boss move:** add it to `BossMove` and `BOSS_MOVES` (and to the rounds in `BOSSES`), its
  call text and action in `tickBoss`, and its warning in `drawBars`.
- **Add a boss:** add it to `EnemyKind`, `BossKind`, `BOSS_KINDS`, `ENEMIES`, `SCRAP` and `BOSSES`
  (name and round of moves), a `GEOM` box and a sprite in both styles (the bosses are painted at
  1.9x like the Behemoth), and anything it does on death in `kill`.
- **Add a perk:** add it to `Perk` and `PERKS` (which upgrade it evolves from), and apply it in
  `fire`, `hitTargets` or `moveEnemies`; the HUD lists it on the kit panel on its own.
- **Add a condition:** add it to `Condition`, `CONDITIONS` and `CONDITION_DRAWS`, and read
  `state.condition` where it applies (`fire`, `moveEnemies`, `planWave`, `visibility`).
- **Add an outpost upgrade, role or operation:** add it to `OUTPOST`, `ROLES` or `OPERATIONS` in
  `rules.ts` and a colour in `theme.ts`; apply an outpost level in `create` (or `planWave`), a role
  in `fire`, an operation's rules in `startWave`/`planWave`. The game over screen lays out four
  outpost buttons and three operations; more need a new layout there.
- **Add a new phase or screen** (title, pause): extend `Phase`, guard `update`, `spawn` and the
  `pointerdown` handler on it, and keep wave 1 starting at once or update the test's opening steps.

## Gotchas

- The crate captions (`label-<kind>`) and the comic's sound words (`sfx-*`) are baked into
  textures in the language the page opened with; the language only changes on the hub, so a game
  page never needs to re-bake them.
- The hero's x is the rifle, not the sprite centre: `GEOM.hero.ox` is the rifle's column, and both
  styles paint the rifle at x 0.
- `HERO` and `DRUM` are tuning in `rules.ts`; `GEOM` in `paint.ts` is only the drawing box.
- The boss bar is drawn under the progress strip at the top, as the squad's back rows fill the
  bottom.
- `REACH_Y` drives the game over line, the sandbag row and the gap in the lane dashes, and crates
  and drums are lost past it.
- Crates and drums do not block wave clear: a wave can end with one still on the road, and it
  keeps moving into the break.
- Crate and drum hit boxes are squares (`PICKUP.halfSize`, `DRUM.halfSize`), enemy hit boxes are
  circles (`radius`). Hits are swept: `hitTargets` tests each bullet's whole move this frame, from
  `prevY` to `y` (either way, as a ricochet can fly down), so a long frame can't carry it through a target, and a piercing bullet hits
  the nearest enemies first. Zombies in the drum's column shield it, which is why drums are one hit.
- Screens: `src/main.ts` calls `setupScaling(game, { fill: true })` from `shared/scaling.ts`, so
  the canvas has `renderScale` canvas pixels per game pixel (up to 4 on a 4K screen) and the camera
  is zoomed to match, and the view takes the screen's shape: 540 wide and up to 1296 tall on a long
  phone, up to 720 wide and 960 tall on a 3:4 tablet (a desktop window, turned the other way round,
  keeps 540x960 and the backdrop). The road and every rule stay laid out for `VIEW` (540x960):
  `create` calls `fitField(viewSize)` (`src/art/paint.ts`), which sets `FIELD`, the whole view in
  the road's coordinates (centred across it, `FIELD.x` going below 0; any extra height below the
  sandbags, behind the squad), and scrolls the camera to `FIELD.x, FIELD.y`, so taps still read
  `pointer.worldX/Y`. The ground, sandbags, HUD bar and night-vision scan layer are painted over
  `FIELD` (their `GEOM` boxes follow it), the blackout, blood moon, grain and overlay shades cover
  it, `fitHud` in `Hud.ts` pins the top bar's ends, the style switch and condition chip to its
  right edge, stretches the progress strip and boss bar across it and puts the kit and frenzy
  panels in its bottom corners, and `centreOverlay` moves the supply drop, role pick and game over
  (and their tap boxes) down to the middle of a taller view. At 540x960 `FIELD` is the view and
  nothing moves. Bullets are dropped once they leave `FIELD` (at the top: once above the HUD bar;
  a ricochet can fly down and leave at the bottom). Texts take `renderScale` as their resolution (don't set one). `bake` paints
  at `sharpRes`: full-screen textures (`FULL_SCREEN` in `paint.ts`) at 1x on a screen that needs no
  scaling and at most 2x, sprites at `HI` (2x) and at most 4x, since painting, and night vision's
  per-pixel pass, slows with the square of it. On a phone held sideways the shared scaling turns
  the game to fill the screen. `e2e/screens.spec.ts` at the root opens the game on five screens.
- A texture's painted size depends on the screen, so read scales from it: `skin` sets the scale
  that fits the texture to its box (`unit(img)`), so don't set a sprite's scale before `skin`; set
  extra scale (splats, effects) after it, as `unit(img)` times the factor.
- `effect` re-skins its pooled image each time, so `skins` holds the last sprite each one showed;
  `applyStyle` releases all effects so none show a missing texture.
- Pools never shrink; `Pool.live()` allocates a new array each call, so avoid it in hot loops.
- The repo forbids red crosses: the favicon's aiming mark is a green crosshair, the damage crate
  shows only an orange band (no plus), the medkit icon has a green cross, and the boss's charge
  warning is orange with an arrowhead (a red ring with a line through it would read as a red
  crosshair). Keep them all non-red-cross.
- A wall sprite is skinned first and then stretched to its lane (`placeWall`), as `skin` sets the
  scale; `applyStyle` only swaps its texture, so the stretch survives a style switch.
- The supply drop pauses the whole update (`'supply'`), so crates, drums and survivors on the
  road wait too.
- Survivors are in the bullets' sweep with the zombies, so a survivor hit by a pellet, a marksman's
  round or a ricochet takes the bullet; with pierce it goes on through them. A rifle holding its
  shot for a survivor still shows its muzzle flash.
  The favicon is the hub bear (ears, head, dot eyes, muzzle) with a helmet set between its ears.
