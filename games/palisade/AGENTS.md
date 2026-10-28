# Palisade: guide for agents

How Palisade is built and where it stands, for agents about to change it. `README.md` covers how to
play, the foes, the relics and the upgrades. Keep this file up to date with any change to the game,
as the root AGENTS.md asks.

## Current state

Palisade is a one-screen wave defense game in low-poly 3D. A ranger who cannot move shoots on
their own from behind a barricade at foes walking in from the right. Each kill gives experience
(more during a kill streak), pays coins and charges two actives the player drags onto the field:
Arrow Rain, a volley, and Caltrops, a patch of spikes. Coins hire guards onto two slots on the
barricade. Each level-up pauses the battle on a pick of three cards, taking one at random after 10
seconds without a tap.

- **Loop:** a break with the wave's banner, then the wave's foes come on one by one. Clearing it
  repairs a tenth of the barricade and starts the next break. Foes hack at the barricade, and once
  it is at 0 they walk on (to a bought stake line first, see Fortifications). The run ends when one
  reaches the hero (`phase` becomes `'over'`).
- **Siege lifted and heats** (`heat.ts`): clearing `WIN_WAVE` (30) for the first time in a run
  sets `won`, raises `heatUnlocked` to `heat + 1` (up to `MAX_HEAT`, 3) and sets `phase` to
  `'won'`, which holds everything (`held(state)` is `'over'` or `'won'`; `tick` stops, `loose`,
  `strew`, `hire` and `train` refuse) under the victory panel. `keepFighting` sets the phase back
  to `'break'` (the relic chest and road choice set by `clearWave` are still there); `startHeat`
  starts a new run at an unlocked heat (from the victory panel it counts the run in `runs`, as a
  fall does; after a fall it was counted already). `heat` and `heatUnlocked` are in `Progress`.
  `heatRules(heat)` is cumulative: Heat 1 scales `spawnInterval` by 0.7, Heat 2 adds a bar in
  `bossBars` (so in `foeHp` too), Heat 3 halves `stats().repair` and `stats().mend`. `stats` takes
  `heat`, so it is a `Pick` of `ranks`, `relics` and `heat`. The game-over panel has a "Next run
  at" row of heat buttons (`restartAt`), and a chip beside the wave track shows `heat` when above 0.
- **Elite foes** (`elites.ts`): from `ELITE_FROM_WAVE` (4) `spawn` rolls `eliteChance(wave)` per
  non-boss foe and a trait from `TRAIT_IDS` (two `Math.random` calls, only from wave 4, so the
  first waves' random sequence is unchanged). An elite has `ELITE_HP` times the health and gives
  `ELITE_XP` times the experience and `ELITE_COINS` times the coins in `removeDead`. `Enemy.trait`
  is `'splitting'` (in `removeDead`, `SPLIT_INTO` goblins with `SPLIT_HP` of a goblin's health are
  added at its spot, clamped to the road and kept on the road's side of a standing barricade or
  stake line, with a `split` effect), `'enraged'` (`moveEnemies`
  multiplies its pace, so walk and barricade damage, by `ENRAGE_PACE` below half health) or
  `'warded'` (`ignite` and the chill in `arrowHit` skip it). The scene draws a coloured hexagon and
  the trait's name over its health bar (`eliteLabels`, one text per elite) and a rune ring for Warded.
- **Aim priority** (`aim.ts`): `state.aimMode` (`AimMode`: nearest, strongest, flyers, healers)
  orders `targets(state)` through `sortTargets`, so the arrows and lightning follow it; the mage
  and `crowdSpot` ask for `'nearest'` and fireballs still pick the crowd. The toggle at `AIM` in
  the layout (and T) calls `setAim` with `nextAim`; the choice is saved under `palisade-aim`
  (`loadAim`/`saveAim`) and passed into `newRun`, so "New hero" keeps it. Default `'nearest'`
  plays exactly as before.
- **Boss moves** (`bosses.ts`, `bossMoves` in `sim.ts`, run before `moveEnemies` for bosses in
  view): a boss's `castMs` is its move timer (set at spawn to `FIRST_ROCK_MS` or `FIRST_ROAR_MS`).
  The Troll King throws a `'rock'` missile (`target` null, with `from`, `to` and `slot`) every
  `ROCK_MS` at a random hired guard, or at the barricade's face when none is hired (skipped if the
  barricade is down too); `moveMissiles` flies it straight to `to` over the foes and `landRock`
  sets `Guard.stunMs` to `STUN_MS` (a stunned guard skips `guardsAct`) or takes `ROCK_DAMAGE` off
  the barricade, with a `rockHit` effect. The Ogre Warlord, once below half health (`moved`), adds
  `CALL_GOBLINS` goblins beside it (`call` effect). The Frost Giant sets `state.roarMs` to
  `ROAR_SLOW_MS` every `ROAR_MS` (`roar` effect); while it runs `shoot` multiplies the bow's
  cooldown by `ROAR_SLOW` and the scene shows the "Chilled bow" chip at `ROAR_CHIP`.
- **Fortifications** (`forts.ts`, `state.forts`): the "Fortify" button at `FORTIFY` (always shown,
  lit while `canFortify`) opens `FortifyPanel`; `fortify(state, id)` buys one per break
  (`forts.boughtWave` is the wave whose break it was bought in; `canFortify`, and `canBuyFort` per
  fortification, which refuses an oil pot while one is armed). During a wave it pays at once and
  sets `forts.queued`; `clearWave` sets the queued one up when the next break starts (`setUpFort`,
  as that break's one) and clears it, so fortifications only change during breaks. One can be
  queued at a time. `stakes` sets `forts.stakeHp` to `STAKE_HP`: in
  `moveEnemies`, once the barricade is down, walking foes stop at `STAKE_FRONT` and hack the stakes
  instead (Spiked Stakes counts there too), and foes already past the barricade's face when it is
  mended (Stout Timber, Mend) keep hacking them; `oil` arms `forts.oil`, which `burstOil` spends on the
  first foe to start hacking at the standing barricade (`OIL_HIT`, `ignite` for `OIL_MS`, a
  `fireblast` effect); `lookout` sets `forts.lookout` to `LOOKOUT_WAVES`, counted down in
  `clearWave`, and `rainRingOf(state)` (used by `crowdSpot`, `landVolleys` and the scene's `ring()`)
  multiplies `stats().rainRing` by `LOOKOUT_RING` while it lasts. The scene draws them in
  `drawForts`. A new run starts with none (`freshForts`).
- **Paid repairs** (`REPAIR_SHARE`, `repairCost` in `forts.ts`): the "Repair" button at `REPAIR`
  (always shown, lit while `canRepair`) calls `repair(state)`, which during a break (no level-up)
  with the barricade hurt spends `repairCost(state.repairs)` coins (15, then 10 more each time),
  counts `repairs` up and mends `REPAIR_SHARE` (15%) of `barricade.max`. Heat 3 does not halve it.
  A new run starts at 0 repairs.
- **Omens** (`omens.ts`, `state.omen`): `clearWave` rolls one of `OMEN_IDS` for the next wave when
  `omenWave(wave)` holds (from `OMEN_FROM_WAVE`, 4, but not on a road's first wave, whose break has
  the relic chest and road choice), sets `omen` to `{ id, accepted: false }` and the break to
  `OMEN_BREAK_MS` (6 s). `OmenCard` shows it with Accept and Refuse, which call `decideOmen`: accept
  sets `accepted`, refuse clears `omen`, and either cuts the break to at most `BREAK_MS`. When the
  break ends an undecided omen is cleared (refused). `omenEffects(omen)` gives what an accepted one
  changes: `sight` (Night: `sightOf` caps it at `NIGHT_X`, so `targets` only takes foes left of
  it, and with it the arrows (and their turn to a new foe when theirs dies, they pierce one or
  they fly on with none, every step until one is seen; an arrow that has pierced a foe only
  turns to one ahead of it, never back), lightning's leaps, fireballs, the mage and
  `crowdSpot`; `moveMissiles` only lets an arrow, fireball or magic bolt strike a foe left of
  `sightOf`, so a stray one flies on through the dark; `loose` and `strew` clamp to it through
  `fieldSpot`, so no volley or patch lands in the dark; the scene hides foes right of it, darkens
  the field with `nightG` and draws no effect (nor a shaman's healing mote) there), `elites` (Blood Moon doubles `eliteChance` in `spawn`), `coins` and `speed` (Rich
  Plunder, in `removeDead` and `moveEnemies` with the road's), and `xp` (`OMEN_XP`, 1.3, on every
  kill's base experience). The chip at `OMEN_CHIP` names an accepted omen until the wave is cleared,
  when `clearWave` replaces it.
- **Forced march** (`march.ts`): `newRun(progress, aim, start)` starts a run on `start` with
  `marchCoins(start)` coins and the rain need for that wave. `MARCH_STARTS` are waves 1, 11 (120
  coins) and 21 (300 coins); `canMarch(bestWave, wave)` needs `bestWave >= wave - 1`.
  `fightAgain(state, start)` and `startHeat(state, heat, start)` fall back to wave 1 when the march
  is not earned. The game-over panel's "Start at" row (`drawMarchPicks`) sets `GameScene.startWave`,
  which "Fight again" and the heat buttons use; it goes back to 1 after every restart (`restart`,
  `restartAt`, a retirement). "New hero",
  a retirement and the victory panel's "Heat N" always start on wave 1. The skipped chests give
  nothing, and the run starts on a road with no twist (`road` null).
- **Retire for a legacy** (`legacy.ts`, `state.legacy`): `canRetire` holds once `offerable` is
  empty or `heatUnlocked > 0`. "Retire" on the game-over and victory panels (dim until then, with
  `retireNote` under it after a fall) opens `LegacyPanel` with a relic from `rollLegacyRelic`;
  tapping a card calls `retire(state, id, relic)`, which returns `newRun(freshProgress(legacy))`:
  a hero from scratch (level 1, no ranks, best wave, heats or runs) with `legacy.retired` counted
  up and the perk added: `relics` gets the relic (stacks), `slot` or `rain` set (once each; `canKeep`
  greys a held one out). `freshProgress(legacy)` puts the legacy's relics into `relics`; `newRun`
  gives `guards` a third entry with `slot` (`GUARD_SLOTS[2]`, between the others, shown and tappable
  only then), and `stats().rainCharge` is multiplied by `QUICK_RAIN` (0.75) with `rain`. "New hero"
  keeps the legacy too (`freshProgress(state.legacy)`).
- **Road to the boss:** waves come in roads of ten (`waveTrack` in `waves.ts`), shown as a track
  under the top bar. The tenth wave of each road ends with its boss (`bossOf`: the Troll King, the
  Ogre Warlord, the Frost Giant, then round again) with stacked health bars. Clearing a boss wave
  opens the relic chest: a random relic (`RELICS`, a lasting bonus that stacks; two after a
  Hardened Road) goes into `relics`, and `relicFound` (a list) shows them during the next break.
- **Relic sets:** each relic has a `set` (`SETS` in `relics.ts`: Hunter's, Warlord's, Warden's, two
  relics each). `setComplete(relics, set)` holds when every relic of a set is held, and `stats`
  adds the set's bonus once (`rainDamage`, `critChance`, `repair`).
- **Road choice:** clearing a boss wave also sets `roadChoices` (two of `ROAD_IDS` in `roads.ts`) and
  `roadMs`; the break's countdown waits while they are up (`RoadChoice` cards, under the relic
  panel). `pickRoad` sets `road` for the next ten waves; after `AUTO_PICK_MS` one is taken at
  random. `roadEffects(road)` gives the twist's multipliers: foe health (`foeHp`), foe count
  (`waveFoes`), experience and coins (`removeDead`), foe speed (`moveEnemies`) and relics in the
  chest (`clearWave`). The first road (`road` null) changes nothing, and a new run starts there.
- **Foes:** besides goblins, orcs and dark knights: harpies (`flying`, from wave 3) spawn above the
  far edge of the road, fly over the barricade and caltrops straight at the hero, and get a shadow
  drawn `FLY_HEIGHT` below them; shield bearers (`shield`, wave 5) take only a quarter of an arrow's
  hit (`SHIELD_BLOCK`) with no burn, chill or pierce, while the arrow's burst still hits them
  (a `block` effect); shamans (`healer`, wave 7) heal hurt foes within `HEAL_RANGE` every
  `HEAL_MS` (first after `FIRST_HEAL_MS`, counted in `castMs`; a `heal` effect).
- **Caltrops:** kills charge `caltrops.charge` up to `need` (`CALTROP_KILLS`, 6). When full, the
  button above Arrow Rain's is dragged onto the road (or C strews them before the thickest crowd);
  `strew` adds a `Patch` with `waves` set to `CALTROP_WAVES` (5); `clearWave` counts it down and
  lifts it at 0, and the scene dims it on its last wave (its `ms` counts up, for the fade-in). A
  strew past `MAX_PATCHES` (3) lifts the oldest. A new run starts with none. Foes on a patch (not flyers) are slowed by
  `caltropSlow` (40%) and take `caltropDps` (80%) of an arrow's damage a second, ignoring armour;
  Barbed Caltrops raises both.
- **Skills that hit harder:** `arrowHit` multiplies the arrow's own hit (not its burst) by
  `chilledDamage` on a chilled foe (Shatter), by 2 on a foe below `finisher` of its health
  (Finishing Shot) and by `bossDamage` on a boss (Giant Slayer, which also counts for Arrow Rain in
  `landVolleys`). Cloudburst raises `rainDamage` and `rainRing`, which scales `RAIN_RING` in
  `inRing` (its last argument), `crowdSpot` and the scene's `ring()`. Spiked Stakes (`stakes`)
  hurts every foe with `attacking` set in `moveEnemies`, through armour. Bounty Hunter (`bounty`)
  adds coins per kill in `removeDead`, and Drill Sergeant (`guardSpeed`) divides each guard's
  cooldown in `guardsAct`.
- **Coins and guards:** each kill adds `ENEMIES[kind].coins` (doubled on a Golden Road) to
  `coins`, kept for the run only. `guards` has one entry per `GUARD_SLOTS` slot (null when empty).
  Tapping a slot opens `HirePanel`, which calls `hire(state, slot, kind)` or `train(state, slot)`
  (`GUARDS`, `trainCost`, `guardDamage`, `MAX_GUARD_LEVEL` in `guards.ts`). `guardsAct` runs each
  step: a spearman stabs the foe within `SPEAR_REACH` of the barricade's face nearest his slot in
  height (armour counts, shields don't), a mage launches a homing `magic` missile that bursts over
  `ARCANE_RADIUS` through armour and shields.
- **Arrow Rain:** kills charge `rain.charge` up to `rain.need` (`rainNeed`: 4 on wave 1, one more
  every other wave, fewer with the Endless Quiver). When full, the button above the ranger is
  dragged onto the field and let go (or R / Space looses it on the thickest crowd); after
  `RAIN_FALL_MS` the volley hits every foe in an elliptical ring for 4x the arrow damage.
- **Kill streak:** each kill within `streakMs` (2.5 s, longer with the Streak Banner) of the last
  adds to `streak.count`; from two on every kill gives `streakBonus` (5% a kill, up to 50%) more
  experience, totalled in `streak.bonusXp`. Each kill pops "+N XP" (and "xN") and sends orbs to the
  experience bar, whose gold segment shows experience still in flight.
- **Every skill learned:** once `offerable` is empty, `rollChoices` returns `BASE_SKILLS`
  (`swift`, `sharp`, `timber`, in `upgrades.ts`), whose ranks then go past `maxRank` with no cap,
  so the hero keeps growing and there is no wave the hero can no longer outgrow. The cards say
  "Rank N, no cap" and the skill book shows the rank alone. Picking any card while `offerable` is
  empty sets `mastered` (saved with the progress), which only fills the skill book's filler pages.
  A skill added later puts the usual cards back, since `offerable` is no longer empty.
- **Progression:** level, experience, upgrade ranks, relics, pending level-ups (with the cards up for them), best wave, run
  count, `mastered` and the legacy carry over between runs. Every run restarts at wave 1 (or a forced march's start) on a road with no twist, with no coins
  (or the march's stake), guards or caltrops.
- **Screens:** there is one scene with the battle and HUD, plus overlays drawn over it: the
  level-up cards (`LevelUp`), the skill book (`SkillBook`, opened by the "Skill book" button in the
  top bar, with the relics and full sets along its bottom), the relic chest panel and the road
  cards (`RoadChoice`, both during the break after a boss), the omen card (`OmenCard`, in the
  breaks from wave 4), the hire panel (`HirePanel`), the game-over panel with "Fight again", "New
  hero" and "Retire", the heat row and the "Start at" row, and the legacy cards (`LegacyPanel`).
  There is no title or menu screen.
- **Rough edges seen in the code:**
  - The save holds no version, so there is no migration path (relics are merged over
    `freshProgress`, so older saves load with none).
  - Progress is only saved when the phase, wave, level or pending level-ups change and on a pick
    (tapped or auto). Experience and kills gained mid-wave are lost on a reload.
  - There is no in-game settings panel of its own (the shared pause screen has the volumes, see
    Hub settings and Sound), and the hero has a single frame. Arrow Rain can be loosed during a break, when
    there may be no foes to hit; the same goes for the caltrops.
  - The original balance lets a hero who always takes the first card reach wave 40 at a high level;
    the new foes, elites, boss moves and roads add pressure, and the heats are the ladder past the
    win on wave 30, but the curve itself is unchanged.

## Architecture

### File map

- `src/howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English (which US English shares, as nothing in it is spelled differently) and German, picked with
  `byLanguage` and handed to `setupGame(game, { howToPlay })` in `src/main.ts`; update every
  language when the controls or the first round change.
- `src/i18n.ts` and `src/i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British
  English source, `i18n/de.ts` the German and `i18n/en-US.ts` the texts spelled differently in US
  English (none so far, so it is empty). `t(key, vars)` shows a text in the hub's language;
  `TextKey` types the keys. Every text on screen goes through `t`: the tables in `src/game/`
  (`UPGRADES`, `RELICS`, `SETS`, `ENEMIES`, `TRAITS`, `AIMS`, `GUARDS`, `ROADS`, `OMENS`, `FORTS`,
  `LEGACIES`, `HEAT_RULES` and `HEAT_UNLOCKED`) hold `TextKey`s for their names and texts, never
  the text itself, and the scene and `src/ui/` look them up with `t`. Game logic compares ids only.
  German joins a number and its unit (`25 %`, `3 s`) with a no-break space so wrapping never
  splits them.
- `src/audio/`: `sfx.ts` (the sound table, `sfx(name)`) and `music.ts` (the songs `MARCH` and
  `BOSS_MARCH`), see Sound.
- `src/trophies/`: the game's ten trophies (`shared/trophies.ts`). `index.ts` lists them
  (`trophies`: id, tier, icon, `hidden` for A hero remembered and Through the fire) with their
  texts in `trophies/i18n/` (`en.ts` and `de.ts`: the name keyed by the id, what earns it by
  `<id>Text`), and imports nothing else from the game, since the hub loads it for its trophy shelf.
  `main.ts` hands `trophies` to `setupGame`, which lists them on the start and pause screens.
  `check.ts` holds each trophy's condition on the `GameState` (`EARNED`: a wave cleared, an Arrow
  Rain in the air, a guard hired, a `STREAK` of 10, the Troll King's wave cleared, a relic set
  complete, a hero retired, every skill learned (`offerable` empty), the siege lifted, a win at
  Heat 3) and `checkTrophies(state)`, which `GameScene.update` calls every frame after the tick;
  the first call after the page loads awards quietly, so a loaded hero earns theirs without a
  toast. A new trophy is an entry in `index.ts`, its two texts in each language file and its
  condition in `EARNED`.
- `src/main.ts`: creates the `Phaser.Game` (960x540 from `VIEW`, `pixelArt: false`, FIT scaling)
  with `BootScene` and `GameScene`, calls `setupGame(game)` and `setupScaling(game, { fill: true })` (the view takes the screen's
  shape, see Screens), and puts
  `game` on `window` in the dev build.
- `src/game/`: the rules in plain TypeScript, with no Phaser imports.
  - `state.ts`: `GameState` and its parts (`Enemy`, `Missile`, `Effect`, `Volley`, `Patch`,
    `Guard`, `Forts`), field geometry (`FIELD`, `SPAWN_X`, `BOW`, `HERO_FRONT`, `BARRICADE_FRONT`,
    `GUARD_SLOTS`, `BASE_GUARD_SLOTS`), `xpToNext`, `stats` (all upgrade, relic, set and heat effects), `streakBonus`,
    `STREAK_MS`, `RAIN_KILLS`, `CALTROP_KILLS`, `rainNeed`, `newRun`, `Progress`, `progressOf`,
    `freshForts`, `offerable`.
  - `sim.ts`: `tick` (the battle and the auto-pick countdown), `held`, `pick`, `offer`, `rollChoices`,
    `reoffer`, `pickRoad`, `fightAgain`, `startHeat`, `keepFighting`, `loose` (Arrow Rain), `strew`
    (caltrops), `hire`, `train`, `fortify`, `canFortify`, `canBuyFort`, `repair`, `canRepair`,
    `decideOmen`, `canRetire`, `retire`, `rollLegacyRelic`, `setAim`,
    `crowdSpot`, `inRing`, `rainRingOf`, `AUTO_PICK_MS`, `RAIN_FALL_MS`, `RAIN_RING`, `CALTROP_PATCH`,
    `CALTROP_WAVES`, `MAX_PATCHES`, `SHIELD_BLOCK`, and the private steps: spawning (elites), shooting, guards (stuns), missiles
    (rocks), boss moves, volleys, damage, foe movement (caltrops, healing, the stake line, the oil pot), kills (coins, streak, charges, experience, splitting),
    wave clear with the relic chest, road choice and the win, game over.
  - `elites.ts`: `Trait`, `TRAITS`, `TRAIT_IDS`, `ELITE_FROM_WAVE`, `eliteChance` and the elite and
    trait numbers. `bosses.ts`: the bosses' move numbers. `forts.ts`: `FortId`, `FORTS`,
    `FORT_IDS`, `STAKE_FRONT`, `STAKE_HP`, the oil and lookout numbers, `REPAIR_SHARE` and
    `repairCost`. `omens.ts`: `OmenId`, `OMENS`, `OMEN_IDS`, `OMEN_FROM_WAVE`, `OMEN_BREAK_MS`,
    `NIGHT_X`, `OMEN_XP`, `omenWave`, `omenEffects`. `march.ts`: `MARCH_STARTS`, `canMarch`,
    `marchCoins`. `legacy.ts`: `LegacyId`, `LEGACIES`, `LEGACY_IDS`, `Legacy`, `freshLegacy`,
    `QUICK_RAIN`, `canKeep`. `heat.ts`: `WIN_WAVE`,
    `MAX_HEAT`, `HEAT_RULES` and `HEAT_UNLOCKED` (text keys: each heat's rule, and the victory
    panel's line when it unlocks) and `heatRules`. `aim.ts`: `AimMode`, `AIM_MODES`, `AIMS`,
    `nextAim`, `sortTargets`.
  - `enemies.ts`: the `ENEMIES` table of wave 1 stats per `EnemyKind` (with `coins` and the
    `flying`, `shield` and `healer` flags), the three bosses included.
  - `upgrades.ts`: the `UPGRADES` table, `UpgradeId`, `Icon`, `UPGRADE_IDS`, `BOOK_ORDER` (the
    skill book's order only; the level-up's random picks follow `UPGRADE_IDS`), `FILLERS`,
    `BASE_SKILLS` and `PURSE_COINS`.
  - `relics.ts`: the `RELICS` table, `RelicId`, `RELIC_IDS`, `SETS`, `SetId`, `SET_IDS`,
    `setRelics` and `setComplete`.
  - `guards.ts`: the `GUARDS` table, `GuardKind`, `GUARD_KINDS`, `MAX_GUARD_LEVEL`, `trainCost`,
    `guardDamage`, `SPEAR_REACH` and `ARCANE_RADIUS`.
  - `roads.ts`: the `ROADS` table, `RoadId`, `ROAD_IDS` and `roadEffects`.
  - `waves.ts`: `waveFoes` (with the road's foe count), `foeHp` (scaled by difficulty and road, a boss's by the heat's bars), `hpScale`, `bossBars` (with the heat), `BOSSES`,
    `bossOf`, `waveTrack`, `isBossWave`, `spawnInterval` (with the heat), break lengths.
  - `save.ts`: `loadProgress`, `saveProgress`, `clearProgress`, `loadSpeed`, `saveSpeed`,
    `loadFound`, `saveFound`, `loadAim`, `saveAim`, `loadAutoPick`, `saveAutoPick`.
- `src/scenes/BootScene.ts`: paints every texture, then starts `Game`.
- `src/scenes/GameScene.ts`: owns the `GameState`, ticks it each frame, draws the battle (elite
  badges and labels, rocks, stunned guards), the HUD
  (coins in the top bar, the heat chip, the "Chilled bow" chip), the wave track (named after the road), Arrow Rain (button, drag arc,
  ring, falling volleys), the caltrops (button, drag arc, patches), the guard slots and guards, the
  fortifications on the field (`drawForts`), the aim toggle and the Fortify button
  (`drawAimToggle`), the streak chip, the relic chest panel, the victory panel (`createWon`) and
  the game-over panel with its heat buttons (`drawHeatPicks`), saves progress, handles restart
  (`restart`, `restartAt`) and the 1x/2x speed switch
  (`speed`, at `SPEED` in the bottom bar).
- `src/scenes/BattleSounds.ts`: plays the battle's sounds and picks the music by comparing the
  state before and after each `tick` (see Sound).
- `src/scenes/layout.ts`: screen positions (`HERO_FEET`, `BARRICADE`, `XP_BAR`, `BOSS_BAR`,
  `TRACK`, `RAIN`, `CALTROPS`, `AIM`, `FORTIFY` (with its panel's size), `REPAIR`, `OMEN`,
  `OMEN_CHIP`, `LEGACY`, `MARCH`, `HEAT`, `ROAR_CHIP`,
  `GUARD_HIT`, `HIRE`, `ROAD_CARDS`, `RAIN_HINT`, `STREAK`, `CARDS`,
  `COUNTDOWN`, `AUTO_TOGGLE`, `SKILL_BOOK`, `SPEED`, `BUTTON`, `BARRICADE_BAR`, `BARRICADE_TIP_W`),
  `HUD_HEIGHT`, `UI_DEPTH`, `FONT` (a system font stack), and `SEEN` (the part of the world the
  view shows) with `placeHud`, which sets it and pins the HUD boxes to the view's edges.
- `src/ui/LevelUp.ts`: the level-up overlay, its cards and the auto-pick countdown (seconds left
  over an emptying bar, at `COUNTDOWN`), with the "Auto-pick" checkbox at `AUTO_TOGGLE` beside it.
  Its `autoPick` flag (loaded with `loadAutoPick`, saved through `onAutoPick`) is passed to `tick`;
  unticked, the bar stays grey and the text reads "Waiting for your pick". It records each card's
  spot in `cards`.
- `src/ui/RoadChoice.ts`: the two road cards after a boss (icon, name, catch and reward) and the
  "Taken at random in Ns" countdown. It records each card's spot in `cards`.
- `src/ui/HirePanel.ts`: the panel a guard slot opens: two rows to hire a spearman or a mage on an
  empty slot, or one row to train a hired guard, each with a button showing its cost (greyed out
  and not tappable when the coins are short), and a dim backdrop that closes it. `slot`/`open`
  tell the scene to hold everything still.
- `src/ui/FortifyPanel.ts`: the panel the Fortify button opens (a note under its title says when
  one can be bought, and a queued one reads "Queued for the next break"): a row per
  fortification in `FORT_IDS` (a little picture, its text, what is held and a Buy button with its
  cost, greyed out when the coins are short or this break's one is bought) and a dim backdrop that
  closes it. `open` tells the scene to hold everything still.
- `src/ui/OmenCard.ts`: the omen card at `OMEN` during a break: "Omen for wave N: name", its text,
  the experience it pays and Accept and Refuse (`buttons` holds their spots), calling back with
  the choice.
- `src/ui/LegacyPanel.ts`: the retire panel over the game-over or victory panel: three cards at
  `LEGACY` (an icon, the perk's name and text; the relic card names its relic; a kept perk reads
  "Kept already" and is not tappable), what earlier heroes left, and Cancel. `cards` records each
  card's spot and `open` whether it is up.
- `src/ui/SkillBook.ts`: the "Skill book found/total" button in the top bar and the book it opens,
  a 4x7 grid with a slot for every id in `BOOK_ORDER` (`upgrades.ts`: one theme a row, the bow,
  harder hits, fire, chill and slow, powder and lightning, the barricade and guards, then Battle
  Lore and the three fillers), and the relics won along the bottom (a full set's relics in green,
  its bonus above them). Hovering over a relic (a zone over its icon and name) shows `relicTip`:
  its name and count, its text and its set with the other relic and the set's bonus.
  A slot not yet in `found` is an empty placeholder (a "?" frame and blank lines); a found one
  shows icon, name, rank of max (`Nx` for a filler, how many times it was picked) and
  `text`, dimmed at rank 0. Its `open` flag tells the scene to hold everything still.
- `src/ui/panel.ts`: the slate-and-gold look: `drawPanel` (a chamfered panel with a lit bevel and a
  gold edge, on a `Graphics`), `chamferPts`, `textStyle` and `makeButton`.
- `src/art/`: low-poly art painted in code on 2D canvases and added with `textures.addCanvas`.
  `lowpoly.ts` has the toolkit (`paint`, `poly`, `facet` for a flat-shaded part lit from the top
  left, `gem`, `softShadow`, colour helpers, the seeded generator `seeded`, and `paint` and `fit`,
  see Screens). `characters.ts` has
  the rigs (parts in local units, feet at 0,0) for the hero, the guards (`guardTexture`), foes and
  bosses, two walk frames per foe (`foeTexture`; the harpy's beat its wings, from `harpyRig`, with
  no baked shadow), `FIGURES` (each texture's feet origin and height) and the missiles, the mage's
  `magic-bolt` included.
  `scenery.ts` has the background (painted at double size and scaled down, at the view's size with
  the sky, hills, road and verge carried on round the designed scene), the HUD bars (the view's width) and the
  barricade stages 0 to 3 (`BARRICADE_TEX`). `icons.ts` has the upgrade icons (`iconTexture`),
  relic icons (`relicTexture`), the chest, the boss marks (`bossNodeTexture`), the Arrow Rain
  and caltrops buttons, the `caltrop` piece, the road icons (`roadTexture`) and small HUD icons
  (`hud-coin` among them). `palette.ts` holds the runtime colours, including `BAR` and
  `BOSS_BARS`.
- `shared/` (repo root, shared by every game): `shared/setupGame.ts` (`setupGame`),
  `shared/scaling.ts` (`setupScaling`, `sharpRes`), `shared/settings.ts` (`settings`,
  `byDifficulty`) and `shared/i18n.ts` (`translator`, `byLanguage`, `Translation`). `waves.ts` and `GameScene` import
  `shared/settings.ts`, and neither file imports Phaser, so `src/game/` stays Phaser-free.

### How it runs

- **Boot:** `BootScene.create` calls `bakeScenery`, `bakeCharacters`, `bakeMissiles` and
  `bakeIcons`. These write canvas textures with keys like `background`, `hud-top`, `hud-bottom`,
  `barricade-N`, `hero`, `guard-<kind>`, `foe-<kind>-<frame>`, `arrow`, `arrow-fire`,
  `arrow-frost`, `fireball`, `magic-bolt`, `rain-arrow`, `icon-<icon>`, `relic-<id>`, `chest`,
  `chest-open`, `node-<boss>`, `road-<id>`, `rain-ready`, `rain-charging`, `caltrops-ready`,
  `caltrops-charging`, `caltrop`, `rock`, `hud-coin`, `hud-flame` and `hud-book`. There are no asset files.
- **Tick:** `GameScene.update(time)` takes `dt` from the frame timestamp (not Phaser's smoothed
  delta), clamped to `MAX_STEP_MS` (250), then multiplies it by `speed` (1 or 2) unless a level-up
  or the road choice is up, so both auto-pick countdowns stay in real seconds, and unless the break
  holds an undecided omen card, so it is read at 1x too. It calls `tick(state, dt)`, which runs
  `step` in substeps of at most `SUBSTEP_MS` (16) and stops while `choices` is set or the run is
  `held` (over, or won and on the victory panel). Only effects keep ageing then. The scene also
  skips `tick` while the fortify panel is open. While `choices` is set, `tick` counts `pickMs` down instead
  (unless its `autoPick` argument, the level-up's checkbox, is false: then `pickMs` holds and only
  effects age),
  and when it reaches 0 it calls `pick` with one of `choices` chosen by `Math.random` and adds an
  `autoPick` effect (at `AUTO_PICK_POP`, with the `upgrade`), which the scene shows as an
  "Auto-picked" pop-up naming the upgrade and its new rank; any time left
  in the frame then goes on to the battle (or the next level-up's countdown). The scene keeps its
  own `clock`, used only for animation phases, pulses and blinking, and it stops during a pick and
  after a fall.
- **Order inside `step`:** age effects, count the streak down (ending it at 0), update
  `rain.need`, count the roar down, bring volleys down (`landVolleys`), count up how long each caltrop patch has lain, then the break countdown
  (or the road choice's countdown while `roadChoices` is set; when it runs out an undecided omen is
  cleared) or spawning, then `shoot`,
  `guardsAct`, `moveMissiles`, `bossMoves`, `moveEnemies` (caltrops, shaman healing, the oil pot,
  the stake line), and finally the
  wave-clear check. Arrows home, turning
  fully towards their target every substep. Every death goes through `removeDead`, which counts the
  kill, pays its coins, charges Arrow Rain and the caltrops, carries the streak, adds `death`, `xp`
  and `orb` effects and calls `gainXp`.
- **Input:** a tap on a level-up card calls `GameScene.pick`, which calls `pick` in `sim.ts`.
  Without a tap, `tick` picks after `AUTO_PICK_MS` (10 s). Arrow Rain: a `pointerdown` on the
  button's hit circle while `rainReady()` sets `aim`; the scene-wide `pointermove` moves it; a
  `pointerup` (or `pointerupoutside`) calls `loose(state, x, y)` if `onField` (right of the
  barricade, on the road) and clears `aim` either way. While dragged, the arc and ring are drawn at
  `fieldSpot(state, x, y)`, the clamped spot where `loose` and `strew` land. The caltrops button works the same way with
  `aimKind` `'caltrops'`, calling `strew` on release. R and Space call `loose` at `crowdSpot`, C
  calls `strew` 40px in front of it. A level-up, a fall, the open skill book or hire panel clears
  `aim`. A tap on a guard slot's zone (depth `UI_DEPTH - 3`, under every overlay) opens
  `HirePanel`, which calls `GameScene.hire`/`train` (the zones, `GUARD_HIT`, are no taller than the
  slots are apart, so the third slot's does not cover the others); the scene holds the battle while it is open and
  closes it on a level-up or a fall, and a tap beside the panel (not on it) closes it. A tap on the Fortify button (always shown; not after a fall or during a level-up) opens
  `FortifyPanel`, which calls `GameScene.fortify`; the scene holds the battle while it is open and
  closes it on a level-up or a fall, and a tap beside the panel (not on it) closes it. A tap on the Repair button calls `repair`, and Accept or Refuse
  on the omen card `decideOmen`. A tap on the aim toggle (or T) calls `cycleAim`. A tap on a road card calls `pickRoad`. "Fight again" calls
  `restart`, "New hero" arms itself on the first tap (`armNewHero`: its caption becomes "Sure? Tap
  again" and `newHeroNote` says what is lost; any other tap on the panel or leaving it disarms it)
  and calls `restart` on the second, the heat buttons on the game-over panel and "Heat N" on the victory panel call
  `restartAt`, a "Start at" button sets `startWave`, "Retire" calls `openRetire` and a legacy card
  `GameScene.retire`, and "Keep fighting" calls `keepFighting`. The "Skill book" button opens `SkillBook`; Back or a tap beside the book closes it.
  While it is open `GameScene.update` skips `tick` and its `clock`, so the battle, effects and the
  auto-pick countdown all wait. The button sits above the level-up overlay (depth `UI_DEPTH + 15`)
  so it works while choosing, and hides after a fall. Shooting is automatic. A dimming rectangle
  under each overlay is interactive, so taps on the battle are swallowed.
  A zone over the barricade's health bar in the top bar shows `barricadeTip` on `pointerover`
  (health of max, Stout Timber's rank and bonus, and `stats().repair` after each wave, refreshed by
  `drawBarricadeTip` each frame) and hides it on `pointerout`; on a phone a tap shows it.
- **Skill book:** after each `tick`, `GameScene.discover` adds every id in `choices` and `ranks`
  to `found` (so an old save's upgrades count as found), and the three `FILLERS` once `mastered`
  (an older save that learned everything before Second Wind could be offered), and saves it when
  it grew.
- **Rendering:** sprites are diffed by id. `foes` and `missiles` are `Map`s of images, the crit and
  "+N XP" texts are `pops`, and each volley's falling shafts are `rainArrows`. Each is created,
  updated or destroyed to match the state every frame. A foe's texture origin and height come from
  `FIGURES`. Health bars, flames, blasts, bolts, death shards, orbs (`fx`, and `glow` with additive
  blending), the HUD (`hud`), the track (`trackG`) and Arrow Rain's button rim, arc and rings
  (`aimG`) are `Graphics` cleared and redrawn every frame. The experience bar's gold segment is the
  sum of the `orb` effects still flying (`inFlight`), and the orbs fly to the end of the blue fill.
  `LevelUp.show` only rebuilds its cards when the choices, their ranks, the level or the picks
  left change, and `SkillBook.show` only rebuilds when what is found, taken or won changes.

### State model

- `GameState` (`src/game/state.ts`) has two halves. The progress fields (`level`, `xp`, `ranks`,
  `levelUps`, `bestWave`, `runs`, `relics`, `mastered`, `heat`, `heatUnlocked`, `legacy` (`relics`,
  `slot`, `rain`, `retired`), and `choices`, the cards up for a pending level-up) form `Progress`. The run fields are `wave`, `phase`
  (`'break' | 'fighting' | 'over' | 'won'`), `breakMs`, `toSpawn`, `spawnMs`, `barricade`, `enemies`,
  `missiles`, `effects`, `cooldown`, `pickMs` (time left to pick before the auto-pick),
  `kills`, `rain` (`charge`, `need`, `volleys`), `caltrops` (`charge`, `need`, `patches`), `coins`,
  `guards`, `road`, `roadChoices`, `roadMs`, `streak` (`count`, `ms` left, `best`, `bonusXp`),
  `relicFound` (a list, or null), `aimMode`, `roarMs`, `forts` (`stakeHp`, `oil`, `lookout`,
  `boughtWave`, `queued`), `won`, `repairs`, `omen` (`id`, `accepted`, or null) and `nextId`.
- `Enemy` holds its position, `hp`/`maxHp`, boss `bars`, slow and burn timers, `attacking`,
  `hitMs`, `castMs` (a shaman's healing timer, a boss's move timer), `trait` (an elite's, or null)
  and `moved` (the Ogre Warlord's call). `Missile` is an arrow, a fireball, a mage's
  `magic` bolt (with its `damage`) or a Troll King's `rock` (with `from`, `to` and `slot`) with a homing `target`, a `hit` list and `pierce`. `Patch` is a
  caltrops patch on the road (`x`, `y`, `ms` it has lain, counting up, and `waves` left). `Guard` is a hired guard (`kind`, `level`, `cd`, `stunMs`).
  `Volley` is an Arrow Rain volley in the air (`x`, `y`, `ms` until it lands). `Effect` is a
  short-lived visual with `ms`/`total`; `xp` and `orb` carry `amount` (the kill's experience) and
  `xp` its `streak`; `autoPick` carries the `upgrade` the countdown took.
- Hero stats are never stored. `stats(state)` derives them from `ranks`, `relics`, `heat` and
  `legacy` (only Quick Arrow Rain, read when present) each time.
  `pick` counts the fillers (`mend`, `purse`, `wind`) in `ranks` too (for the skill book); `stats`
  ignores them and `offerable` never offers one, so their ranks change nothing else.
  `rollChoices` fills the cards no upgrade is left for with `FILLERS`: `mend` with two upgrades
  left, `purse` and `wind` with one left, so a level-up shows three different cards and every
  filler is offered (and found) before the last skill; with none left it offers the base skills
  (see Every skill learned).
- Only `sim.ts` mutates state during play. The scene only replaces it wholesale (`newRun`,
  `fightAgain`, `startHeat`, `retire`), calls `reoffer` on load when level-ups are pending, and calls `loose`, `strew`,
  `hire`, `train`, `fortify`, `repair`, `decideOmen`, `setAim`, `keepFighting`, `pick` and `pickRoad`.
- **Invariants:** `choices` is set while `levelUps > 0`, and the battle (streak timer and volleys
  included) is frozen then. Every place that sets `choices` (`offer`, `fightAgain`) also resets
  `pickMs` to `AUTO_PICK_MS`, so each level-up gets the full 10 seconds. The countdown also stops
  while the run is over. `rain.charge` never exceeds `rain.need`; `loose` refuses unless it is full,
  no level-up is up and the run is not over, and clamps the spot to the road in front of the
  barricade. `streak.bonusXp` is exactly the experience given beyond each foe's `xp * xpGain`.
  `relicFound` is set by `clearWave` on a boss wave and cleared when the next wave starts.
  `roadChoices` is set by `clearWave` on a boss wave and cleared by `pickRoad`, which restarts
  `breakMs`; the break never ends while it is set. `caltrops.charge` never exceeds `caltrops.need`.
  `hire` and `train` refuse during a level-up or a fall, or without the coins; `coins` never goes
  below 0. `fortify` refuses after a fall or the win, during a level-up, twice in one break, with one
  already queued during a wave, or without the
  coins. `phase` is `'won'` only between clearing `WIN_WAVE` and "Keep fighting" (or a new run);
  `won` stays set for the rest of the run, so wave 60 never wins again. `omen` is never set on waves
  1 to 3 or a road's first wave, and an unaccepted one never outlasts its break. `repair` refuses
  outside a break, during a level-up, with the barricade full or without the coins. `guards` has
  `BASE_GUARD_SLOTS` entries, one more with `legacy.slot`. `retire` refuses unless the run is over or
  won and `canRetire`, or for a perk `canKeep` refuses. `heat` never exceeds
  `heatUnlocked`. In
  `moveEnemies` a foe hacks at the standing barricade only when it is at the face (at most one
  substep's walk past it); a foe that got behind it while it was down goes on to a standing stake
  line, or keeps walking when there is none, after a repair (Stout Timber or Mend), and any live foe reaching `HERO_FRONT` ends the run (one that burns to
  death on that substep does not). Foe, missile, volley and effect ids share the one `nextId`
  counter. A boss's `maxHp` is its per-bar health times `bars`. Foes spawn at `SPAWN_X` plus their
  radius and are only targeted once `x < VIEW_RIGHT` (950).

### Persistence

Six `localStorage` keys. `palisade-skill-book` holds a JSON array of the upgrade ids found
(offered on a level-up, or held), read by `loadFound` (unknown ids dropped) and written by
`GameScene.discover` whenever one is new; "New hero" leaves it alone. `palisade-speed` holds the
battle speed (`'1'` or `'2'`, through `loadSpeed`/`saveSpeed`) and `palisade-aim` the aim priority
(an `AimMode`, through `loadAim`/`saveAim`), and `palisade-auto-pick` the level-up's checkbox
(`'0'` when unticked; anything else, or nothing, means on), all kept apart so "New hero" leaves
them alone. `palisade-progress` holds JSON of `Progress`, relics, `heat`, `heatUnlocked`, `legacy` and the level-up's
`choices` included. `loadProgress` merges it over
`freshProgress()` (dropping unknown upgrade and relic ids, and `choices` unless they are three known
upgrades with a level-up pending; an older save gets heat 0 and no legacy, and the legacy's fields are
checked one by one) and falls back to fresh on any error.
"New hero" (on its confirming second tap) calls `clearProgress`, which also drops the relics and the heats, then saves a fresh hero
with the legacy kept. The run itself (wave, foes,
barricade, Arrow Rain and caltrops charge, streak, coins, guards, road, fortifications, repairs, omen) is never saved, so a reload
starts at wave 1.
`palisade-trophies` holds the trophies earned (`shared/trophies.ts`), each id with the time; "New
hero" keeps them.

### Randomness and timing

- `Math.random` is called from fourteen spots, all in `src/game/`. In `sim.ts`: `spawn` (a foe's
  y, one call for every kind but a boss, which walks down the middle, then from wave 4 the elite
  roll and, for an elite, its trait), `arrowHit` (crit roll, called on every arrow hit even at 0% crit
  and on a shield), `rollChoices`, the auto-pick in `tick` (only when the countdown runs out), the
  relic chest and the two roads offered in `clearWave` (only on boss waves), the road auto-pick
  in `step` (only when its countdown runs out), the Troll King's choice of guard in `bossMoves`
  (only on its waves, with a guard hired), the omen in `clearWave` (only when the next wave is 4 or
  more) and `rollLegacyRelic` (only when the retire panel opens). In `waves.ts`: `waveFoes` (shuffle). Arrow Rain,
  the caltrops, guards, shamans, the other boss moves, splitting, the fortifications and the streak use none. Art uses
  its own `seeded` generator, and the scene scatters a volley's shafts with a hash of its id, so
  neither touches the sequence.
- Time comes only from Phaser's frame timestamp in `GameScene.update`. There are no timers or
  `Date.now`.

### Data tables

Foe and boss stats (coins included) are in `ENEMIES` (`enemies.ts`). Guard costs, rates and
damage are in `GUARDS` (`guards.ts`); road twists in `roadEffects` (`roads.ts`); set bonuses in
`stats`. Wave size, health scaling, spawn gaps, boss
cadence and order (`BOSSES`) and break lengths are in `waves.ts`. Upgrade names, texts, ranks and
prerequisites are in `UPGRADES` (`upgrades.ts`); relic names and texts in `RELICS` (`relics.ts`);
the numbers of both are in `stats` (`state.ts`). The barricade base (`BASE_BARRICADE_HP`), the
level curve (`xpToNext`), `streakBonus`, `STREAK_MS`, `RAIN_KILLS`, `rainNeed` and field geometry
are also in `state.ts`. The difficulty multiplier on foe health is in `foeHp` (`waves.ts`).
Missile speeds, `LEAP_RANGE`, effect durations (`EFFECT_MS`), `RAIN_FALL_MS`, `RAIN_RING`, the
caltrops' patch, `CALTROP_WAVES` and `MAX_PATCHES`, `SHIELD_BLOCK` and the shaman's healing numbers are in
`sim.ts`. The elites' numbers are in `elites.ts`, the bosses' moves in `bosses.ts`, the
fortifications' in `forts.ts` and the heats' in `heat.ts`. Arrow Rain's damage (`rainDamage`) and ring (`rainRing`), the caltrops' slow and damage
(`caltropSlow`, `caltropDps`) and the barricade's repair after a wave (`repair`) are in `stats`.

### Screens

- `setupScaling` gives the canvas `renderScale` canvas pixels per game pixel (up to 4 on a 4K
  screen, 2 with the canvas renderer) and zooms the one camera to match from its top-left, so the
  game keeps its 960x540 coordinates. Input reads `pointer.worldX/Y`; nothing reads `scene.scale`
  or `pointer.x/y`.
- **Fill:** with `fill` the view is 960x540 or bigger one way (up to 1296 wide or 720 tall),
  picked once at start. `GameScene.create` takes `viewFrame(this)`, scrolls the camera by minus its
  x and y (so the designed battlefield sits in the view's middle and the world, the sim included,
  keeps its coordinates) and calls `placeHud(frame)` in `layout.ts`, which sets `SEEN` (the shown
  world rect, from `(-frame.x, -frame.y)`) and moves the HUD's layout boxes: the top bar's left
  items (wave, barricade bar and its tip, Skill book button), `TRACK` (and its marks), `HEAT`,
  `BOSS_BAR`, `FORTIFY` and `REPAIR` to the top left; `XP_BAR` stretched along the bottom;
  `SPEED` and `STREAK` to the bottom right; the top bar's foes, slain, coins and best wave to the
  right (placed in `createHud` from `SEEN`). The hero's column (Aim, Caltrops, Arrow Rain, chips)
  stays with the hero; banners, cards and panels stay centred on 480,270, the view's middle; every
  dim overlay is `SEEN`-sized; the Night wave's dark spans `SEEN`. `BootScene` bakes `background`,
  `hud-top` and `hud-bottom` at `viewSize` with the frame. Foes fade in over their first
  `SPAWN_FADE` (36) pixels from `SPAWN_X`, so a wide view doesn't show them pop in (off screen at
  960). At exactly 960x540 the frame is 0,0 and nothing moves, so the playthrough's taps land.
- `paint` in `lowpoly.ts` paints each texture on a canvas `sharpRes(w, h)` times its shown size
  (drawing code still works in shown pixels; blurs and `shadowBlur` are scaled to match), and
  records that factor per key. Every image showing a painted texture goes through `fit(image,
  scale)`, which sets its scale to `scale` over that factor; call `fit` again after `setTexture`
  and use it instead of `setScale`. A bare `add.image` shows the art `renderScale` times too big.
- Texts are drawn at `renderScale` by `shared/scaling.ts`. On an upright phone the shared
  scaling turns the game to fill the screen, and `e2e/screens.spec.ts` at the root opens the game on five screens.

### Sound

Everything is synthesized by `shared/audio.ts`; there are no audio files, and nothing plays under
browser automation. `src/game/` has no sound: `GameScene.update` calls `BattleSounds.mark(state)`
before `tick` and `BattleSounds.play(state, ms)` after it, which plays what the tick changed (new
effects and missiles are those with an id at least the `nextId` from before) and switches the
music. A new state (a restart, a retirement, the save loaded at start) only sets the baseline, so
nothing plays for it. The player's own taps play from `GameScene` and the panels.

- **Music** (`src/audio/music.ts`): `MARCH`, A minor at 120 BPM, a thin pulse "fife" lead over a
  marching triangle bass and snare rolls. `calm` in a break, `battle` during a wave, `pad` (held
  chords) while a level-up's cards wait and under the game-over and victory panels, and the stings
  `lose` (on a fall) and `win` (A major, when the siege is lifted). Boss waves play `BOSS_MARCH`'s
  `boss` part instead: 100 BPM over a low ostinato. `BattleSounds.music_` picks the part each frame
  and only calls `playMusic` when it changes. The 2x speed switch leaves the tempo alone.
- **Effects** (`src/audio/sfx.ts`, at most one of each per frame), from `BattleSounds.play`:
  `bow` (any arrows launched: one per volley), `hit` (an arrow gone mid-field), `crit`, `clank`
  (`block`), `blast`, `boom` (`fireblast`: fireball, oil pot), `whoosh` (a fireball or a Troll King's
  rock thrown), `magic` (a mage's bolt), `arcane`, `zap` (`bolt`), `stab`, `heal`, `thud`
  (`rockHit`), `horn` (a wave starts; higher for the Ogre Warlord's `call`), `roar`, `pop` (a
  `death`, lower for bigger foes) or `bossDown`, `split`, `xp` (pitched up with the streak),
  `rainLand` (`rain`), `pick` (`autoPick`), `ready` (Arrow Rain or the caltrops just charged),
  `chop` (every `CHOP_MS` while the barricade or stake line loses health), `crash` (either reaches
  0), `levelUp` (the level went up), `cleared` (a wave cleared into a break) and `relic` (with the
  chest). Effects at or right of a Night wave's `sight` stay silent, the same line past which the scene hides them.
- **The player's taps:** `rainLoose` and `caltrops` when `loose`/`strew` succeed (drag, R, Space,
  C), `pick` for a card, a road or a legacy, `build` with `ui('coin')` for `hire`, `train`,
  `fortify` and `repair`, `omen` for an accepted omen, `ui('click')` for every `makeButton`, the aim
  toggle, the speed switch, the Fortify button, a guard slot, the skill book button, the
  auto-pick checkbox and a "Start at" pick. `ui('refuse')` for every refused action: a tap on an
  uncharged Arrow Rain or caltrops button (or R, Space, C), letting go off the road, a repair or
  purchase that fails, a greyed-out Hire, Train or Buy button or kept legacy card (their zones are
  interactive only for that), a locked heat or march, and Retire while it is dim.

### Hub settings

- `src/main.ts` calls `setupGame(game)` from `shared/setupGame.ts` right after creating the game.
  It applies the frame cap (skipped animation frames count towards the next frame's `dt`), the FPS
  readout, reduced motion for camera shake and flash, the corner buttons (full screen, sound, pause
  in the bottom left, which is why the experience bar starts at x 132 with the level at its left
  end) and the shared start and pause screens. Palisade uses neither shake nor flash.
- **Difficulty:** `byDifficulty` scales one number, foe health. `foeHp` in `src/game/waves.ts`
  multiplies `ENEMIES` hp times `hpScale(wave)` by `byDifficulty(0.75, 1, 1.3)` (easy, normal,
  hard) before rounding, so it covers every foe and each boss bar. Nothing else changes.
- **Reduced motion:** `GameScene.blink` and `GameScene.pulse` read `settings.reduceMotion`. With it
  on, a hit foe does not flash white, a burning foe a steady orange tint
  instead of flickering, and the glows that pulse (the charged Arrow Rain button, the streak chip,
  the current wave and boss marks on the track) hold still.
- Keep Normal exactly as designed (multiplier 1): the playthrough runs on Normal, and how its
  wave 1 plays out depends on foe health.
- Keep the Palisade row of the difficulty table in the root README ("foes have 25% less health",
  "foes have 30% more health") and the matching line in this game's README in sync with the
  multipliers.
- The settings live under the `hub-settings` storage key, written by the hub and read once when the
  page loads, not in `palisade-progress`.

## Testing hooks

- In dev, `src/main.ts` sets `window.game`. The test reads `game.scene.getScene('Game')`:
  `.state` (JSON-cloned), `.levelUp.cards` (`CardSpot` id, x, y, w, h), `.track` (`waveTrack` of
  the current wave: `first`, `last`, `boss`, `step`), `.rainSpot` (the Arrow Rain button's centre)
  and `.aim` (where Arrow Rain is being dragged, or null). It never writes to the game. Also there
  to read: `.aimKind`, `.caltropsSpot`, `.roadChoice.cards`, `.hirePanel.slot`,
  `.omenCard.buttons`, `.legacyPanel.cards` and `.startWave`.
- **Trophies:** once wave 1 is cleared the test checks that `palisade-trophies` holds exactly
  Holding the line and Cloud of arrows (the volley it looses); a trophy a first wave can reach in
  another way changes that expectation.
- **Inputs:** the test advances the clock, clicks the centre of a card, and drags Arrow Rain with
  `page.mouse` (down on `rainSpot`, three moves towards a foe with a step of game time after each,
  up), all scaled from the 960-wide view to the canvas box. It never opens the skill book (not part
  of the first round's loop); `.skillBook.open` and `.found` are there to read if a test ever does.
  Nor does it touch the auto-pick checkbox (on with no `palisade-auto-pick` saved), the speed switch, the caltrops, the guard slots or the keyboard: with no
  `palisade-speed` saved the game plays at 1x. Keep the "Skill book" button clear of the cards,
  since it sits above the level-up overlay, and keep the Arrow Rain button clear of other
  interactive objects (the caltrops button and the guard slots included).
- **What it checks:**
  - A fresh hero: level 1, no ranks or relics, wave 1, phase `'break'`, a full barricade, Arrow
    Rain at 0 of 4, caltrops at 0 of 6, no coins, guards or road, no streak, and the track on step
    1 of the road to the Troll King (1 to 10). It never touches the aim toggle, the Fortify button
    or the heats: with no `palisade-aim` saved the ranger shoots the nearest foe, as always, and a
    fresh hero is on Heat 0 with no legacy (two guard slots, Arrow Rain at 4). Elites and omens only
    come from wave 4 and boss moves from wave 10, so wave 1 plays as before; keep `ELITE_FROM_WAVE`
    above 1 and `OMEN_FROM_WAVE` above 2, since the elite roll and the omen roll (made when the wave
    before is cleared) add random calls. The Repair button is never tapped (the barricade stays full).
  - Wave 1 is exactly 3 goblins and 3 orcs, with an orc first.
  - An arrow is fired and hits.
  - The first kill: earned experience equals that foe's `xp` (a streak of 1 has no bonus), the
    streak is 1 with time running, Arrow Rain and the caltrops have 1 charge, the coins are that
    foe's, and there is one `xp` pop and one `orb` for that amount.
  - Every "+N XP" pop seen while it plays is a goblin's or orc's `xp` times `1 + streakBonus`.
  - The first level-up lands at level 2 with earned experience equal to the foes' `xp` plus
    `streak.bonusXp`, three distinct choices that match the card ids, and the foes and the streak do
    not change while it waits. `pickMs` counts down (by more than 0.9 s over the 1 s wait) and
    stays above 0, so the tap beats the auto-pick; the auto-pick itself is not played.
  - Tapping the first card sets that rank to 1.
  - Arrow Rain charges to `need` 4 with a foe in view; dragging it sets `aim`, letting go spends the
    charge, leaves one volley at the release point, and once it lands there is a `rain` effect,
    the foe it was dropped on is gone and kills went up.
  - At most two more level-ups in wave 1, then wave 2 in `'break'` with `bestWave` 1, 6 kills, no
    relic, the barricade above 0, 9 coins, the caltrops charged (6), no guards, a best streak of 2
    or more with `bonusXp` above 0, earned experience equal to 18 plus `bonusXp`, and the track on
    step 2.
- **Mirrored in the test:** `VIEW`, each foe's `xp`, the goblin's and orc's `coins`, `xpToNext`,
  `streakBonus`, `RAIN_KILLS`, `CALTROP_KILLS`, the wave 1 makeup, the field names of `GameState`
  and `AUTO_PICK_MS`. A change to `ENEMIES` xp or coins, `xpToNext`, `streakBonus`, `RAIN_KILLS`,
  `CALTROP_KILLS` or `rainNeed` for wave 1, `waveFoes` for wave 1, `VIEW` or those state fields
  needs a test update in the same PR. New foes join from wave 3 on, so wave 1 stays 3 goblins and
  3 orcs; keep their counts at 0 on wave 1 (`waveFoes` shuffles every foe in the list, so an extra
  one there changes the random sequence).
- **Seeded random:** the test seeds `Math.random`. The upgrades offered, and so the card tapped,
  depend on the exact sequence of random calls. The exact-experience checks only hold if no
  tapped card is Battle Lore (`lore` changes `xpGain`). Adding a random call, or reordering
  `UPGRADES`, can change which card comes first, and Arrow Rain's kills change how many arrows hit
  (each hit rolls for a crit). Rerun the test after any such change. Wave 1 depends on Arrow Rain
  being ready while a foe is still in view, and on a streak of two or more happening.

## Making common changes

- **Add or change a text**: its key in `src/i18n/en.ts`, the German in `src/i18n/de.ts` (the build
  fails without it) and, when its US spelling differs (colour, armour, centre), the US one in
  `src/i18n/en-US.ts`; a table entry names the key, and the scene shows it with `t`. Run
  `node scripts/check-translations.mjs`. German runs longer than English: the Repair button, the
  skill book's slots (two lines of text each), the road cards' Catch and Reward lines and the omen
  card's text line are the tightest spots, so check a new text with `?lang=de`.
- **Add an upgrade:**
  1. Add its id to `UpgradeId` and an entry to `UPGRADES` (with `requires` for a follow-up), with
     its name and text as `<id>Name` and `<id>Text` in the `src/i18n/` files.
  2. Put its effect in `stats`, and read the new stat in `sim.ts`.
  3. Draw an icon in `ICONS` in `src/art/icons.ts`, adding to `Icon` if it is new.
  4. Add a row to the README table.
- **Add a relic:**
  1. Add its id to `RelicId` and an entry to `RELICS` in `src/game/relics.ts`, with its `set`, and
     its name and text in the `src/i18n/` files.
  2. Put its effect in `stats` (read it with `relic('<id>')`). A set bonus goes in `stats` behind
     `setComplete(relics, '<set>')`, with its text in `SETS`.
  3. Draw its icon in `RELIC_ICONS` in `src/art/icons.ts`, and add a row to the README's relic
     table.
- **Add a missile or weapon:** do everything for an upgrade, then:
  1. Add a cooldown to `GameState.cooldown` and `newRun`.
  2. Fire it in `shoot` in `sim.ts`, and if it flies, add its kind to `MissileKind`, handle it in
     `launch` and `moveMissiles`, and pick its texture in `GameScene.drawMissiles`.
  3. Draw it in `bakeMissiles`.
- **Add a road twist:** add its id to `RoadId` and `ROADS` in `src/game/roads.ts`, its multipliers to
  `roadEffects`, an icon in the `roads` table in `bakeIcons`, and a row to the README's road table.
- **Add a guard:** add its kind to `GuardKind` and `GUARDS` in `src/game/guards.ts`, its attack to
  `guardsAct` in `sim.ts`, a rig to `RIGS` baked as `guard-<kind>` in `bakeCharacters`, and a row to
  the README's guard table; the hire panel lists every kind in `GUARD_KINDS` (it has room for two).
- **Add a trait:** add its id to `Trait` and `TRAITS` in `src/game/elites.ts`, its effect where it
  acts in `sim.ts` (`arrowHit`/`ignite`, `moveEnemies` or `removeDead`), and a row to the README's
  trait table. The scene draws every trait the same way, from `TRAITS`.
- **Add a fortification:** add its id to `FortId` and `FORTS` in `src/game/forts.ts`, its field to
  `Forts` and `freshForts` in `state.ts`, what buying it does in `fortify`, its effect in `sim.ts`,
  a picture in `FortifyPanel.drawMark` and `GameScene.drawForts`, and a row to the README's table.
- **Add a boss move:** give the boss a branch in `bossMoves` in `sim.ts` (its numbers in
  `bosses.ts`), an effect kind if it needs one (in `Effect`, `EFFECT_MS` and `drawEffects`), and
  describe it in the README's foe table.
- **Add an omen:** add its id to `OmenId` and `OMENS` in `src/game/omens.ts`, a field to
  `omenEffects`, read it where it acts in `sim.ts`, and add a row to the README's omen table.
- **Add a legacy:** add its id to `LegacyId` and `LEGACIES` in `src/game/legacy.ts` (and a field to
  `Legacy`, `freshLegacy`, `canKeep` and `loadProgress`), set it in `retire`, read it where it acts,
  give its card an icon in `LegacyPanel.addCard` and `LEGACY.xs` a spot, and add a README row.
- **Add a heat rule:** add its text keys to `HEAT_RULES` and `HEAT_UNLOCKED` (with the texts in
  `src/i18n/`) and a field to `heatRules` in `src/game/heat.ts`,
  raise `MAX_HEAT`, read the field where it acts, and add a row to the README's heat table.
- **Add a foe:**
  1. Extend `EnemyKind` and `ENEMIES` (with its `coins`), and `SCALE` in `src/art/characters.ts`.
  2. Add its rig to `RIGS` (parts in local units, feet at 0,0, facing left) and bake it in
     `bakeCharacters`.
  3. Add it to `waveFoes`. Keep wave 1 unchanged, or update the test.
- **Add a boss:** do everything for a foe with `boss: true`, give it a body in `bossRig`, add it to
  `BOSSES` (which sets the order of the roads) and a mark in `marks` in `bakeIcons`, and add a row
  to the README's foe table. The track's title and the wave banner name it from `ENEMIES`.
- **Retune balance:** use the tables listed under Data tables. Anything that changes wave 1 (foe
  xp, foe count, the level curve, the streak bonus or window, or Arrow Rain's charge or damage)
  changes the playthrough's expectations.
- **Move HUD or overlay elements:** edit `src/scenes/layout.ts`. The rules' own positions are in
  `state.ts`, and the two must agree: `HERO_FEET` and `BARRICADE` are drawn to line up with
  `BOW`, `HERO_FRONT` and `BARRICADE_FRONT`.
- **Add a sound:** add it to `sfx` in `src/audio/sfx.ts` and play it from `BattleSounds.play` (for
  something the battle does, read from the state or a new effect kind) or where the scene handles the
  tap; keep `src/game/` free of sound, and list it under Sound.
- **Change the art:** every texture is painted in `src/art/` with the `lowpoly.ts` toolkit. Keep
  the light from the top left (`facet`, `gem`) and shadows to the lower right (`softShadow`). The
  background and barricade are painted in double units (as the approved mockup was) and scaled by
  half; figures are painted in rig units times `SCALE`.

## Gotchas

- Positions live in two places. The rule geometry is in `state.ts`, and the draw positions are in
  `layout.ts` and partly hard-coded in `GameScene` (the banner and
  relic panel at y 170, the game-over panel, the top bar's texts) and in `scenery.ts` (the log at
  double-unit x 365, `BARRICADE_TEX`). Moving the barricade art means moving `BARRICADE` and
  `BARRICADE_FRONT` too.
- `armor` only reduces arrow, burst, Arrow Rain, fireball and spear hits (`hurt(..., true)`).
  Burning, lightning, caltrops, Spiked Stakes, arcane bolts and the oil pot's hit ignore it. Damage after armour is at least 1.
- `STAKE_FRONT` (140) is left of the barricade art and right of the hero: foes hacking the stake
  line stand at `STAKE_FRONT + radius`, over the guard platforms, and are still within
  `SPEAR_REACH`. A split's goblins are placed at the face of a standing barricade or stake line at
  the furthest left (so a Splitting harpy that flew over it drops them on the road's side), or no
  further left than `HERO_FRONT + 20` when both are down, so a split does not end the run on the spot.
- A harpy's `y` is where it flies, above the road's far edge (from `FIELD.top - 50`), so arrows and
  Arrow Rain aim at it there; its shadow is only drawn. `loose` clamps to `FIELD.top`, and the ring
  still reaches harpies flying low enough.
- Experience can be fractional with Battle Lore, the Troll King's Crown or a streak. The HUD floors
  it, and the state keeps the fraction; the test compares it with `toBeCloseTo`.
- `fightAgain` and `startHeat` keep any pending `choices` (through `reoffer`), and `GameScene.create`
  puts the saved ones back up on load when `levelUps > 0` (rolling new ones only when none were
  saved), so a saved hero can open on a level-up overlay with the same cards as before the reload.
- During the break after a boss the wave has already moved on to the next road; the track shows
  the finished road (`waveTrack(wave - 1)`) while `relicFound` or `roadChoices` is set, but
  `GameScene.track` is always the current wave's.
- Storage is shared with the other games on the hub's origin. Keep any new key prefixed
  `palisade-`.
