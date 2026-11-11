# Burrow Brigade: guide for agents

Turn-based artillery with squads of helmeted moles on destructible hills. Read this before changing
the game, and keep it up to date in the same PR as the change (see the root `AGENTS.md`).

## Current state

- **Modes:** Play the Burrow AI (you are Blue Burrow, team 0, and go first), Two players on one
  screen, and Watch AI (`?watch`, both teams run by the AI, a new match four seconds after one
  ends). Teams have 2 to 5 moles (`size` in `burrow-brigade-prefs`, 3 by default), picked on the
  menu. There is no save of a match under way.
- **Daily range** (`mode` `daily`, `startDaily` in the scene, with `shared/daily.ts`): one try a
  day. `Math.random` is swapped for `dailyRand` while `buildWorld` makes the map, theme and kegs,
  and the five winds (`dailyWinds`) are drawn from it too, so everyone shoots the same range: the
  map is `DAILY_W` by `DAILY_H` (960x540) on every screen, framed in the middle of the view by
  `fitWorld` (which moves the camera; the sky and water fill the rest), and the looks whose draws
  vary with the screen or the browser (sky, earth, names, clouds) run on the real `Math.random`
  (`looks`). One blue mole against `DAILY_TARGETS` (4) straw moles that never take a turn, for `DAILY_SHOTS` (5)
  turns. The score (`dailyScore`) is the damage done to them plus `DAILY_KO` (25) for each one
  out; `finishDaily` keeps today's, the best and the streak, shown on the menu and the result.
- **Match report:** `dealt` adds up each mole's damage to enemies (from `World.log.damage` at the
  end of its turn), and the result names the star of the match (`star`).
- **Campaign** (`game/campaign.ts`): eight battles (`BATTLES`) against rival burrows, played from
  the menu's Campaign screen (`showCampaign`, a card per battle). Each has a set theme, its own team
  sizes (`mine` against `foes`, ignoring the menu's size), an aim multiplier for the AI (`aim`), a
  `habit` (a weapon the rival carries `bonus` extra uses of and reaches for first, through
  `planTurn`'s `habit`), and sometimes a twist (`wind` strong or calm, an early `suddenDeath`).
  It plays as `mode` `ai` with `battle` set. A win gives up to three stars (`starsFor`): the win,
  within `par` turns, and no mole lost; the best per battle is saved, and a battle opens once the
  one before it is won (`isOpen`). The result screen shows the stars and Next battle. The rival's
  name (`c_<id>`) replaces Amber Burrow in its panel; its card line is `cd_<id>`. A battle with a
  `boss` (Queen Dusk's Guard) turns the rival's first mole into its leader: that much health, a
  crown (`Mole.hat` `crown`, drawn by `drawHat` and a size bigger) and the name `bossName`.
  Winning the last battle opens the **Veteran** tier (the `tier` button on the Campaign screen,
  `veteran` in the scene): the same battles with `VETERAN`'s changes (one more rival mole, aim
  error times 0.6, one more of each bonus weapon, a tougher boss, 1.5 times the acorns) and their
  own stars (`vstars`, through `tierStars`).
- **Quartermaster** (`game/depot.ts`): every campaign battle pays acorns (`reward`: 15 for a loss,
  40 plus 15 a star for a win), spent from the Campaign screen (`showDepot`) on upgrades with levels
  (`UPGRADE_IDS`, prices in `UPGRADE_COSTS`): thicker helmets (+10 health a level, through
  `Mole.maxHp`), a pocket watch (+5 s on your turns), an extra Boulder Rocket, Shield Bubble or
  Repair Kit, more crates (+15% a level) and a recruit (one more mole). `boosts` turns the levels
  into the match's `boost`; only campaign battles use it, never quick matches or two players.
- **Map:** `generate` (`game/terrain.ts`) makes a fresh map for the view's size each match: rolling
  hills from four sine waves, a ridge in the middle, cliffs into the water at both ends, sometimes a
  water gap splitting the land, 2 to 4 caves and 1 or 2 floating ledges. One of five themes
  (`THEMES`: meadow, autumn, frost, canyon, and ember, whose sea is lava that works like the water
  and splashes in `World.splash`) is picked at random, or set by a campaign battle. `placeKegs`
  stands 2 or 3 powder kegs (`World.kegs`) on dry ground clear of the moles: any blast in reach, or
  a flame touching one, sets it off (`kegBlast`: a radius 42 blast of 38 damage that counts for
  whoever set it off, and six flames), and they fall and sink like crates. `spawnPoints` puts team 0 on the left half
  and team 1 on the right. The water sits `WATER_GAP` (30) above the bottom; a mole or shell in it
  is gone.
- **Turns:** `TURN_TIME` (30 s) to walk, aim and use one weapon, then `RETREAT_TIME` (3 s) to keep
  walking, then `settle` waits for the world to be still (`World.busy`), plays the deaths of moles at
  0 health (each becomes a molehill with a team flag) and ends the turn. Each turn has a new wind
  from -10 to 10 (calm 15% of the time). After a turn a crate falls 40% of the time (30% of those
  heal 25, the rest hold one weapon from `CRATE_WEAPONS`). From turn `SUDDEN_DEATH_TURN` (24) the
  water rises 8 px a turn. Fall damage starts at a landing speed of 360 px/s.
- **Weapons:** 28 in `game/weapons.ts` (`WEAPON_IDS`, grouped `rocket`, `throw`, `strike`, `close`,
  `tool`), each with a `mode`: `aim` (angle and power), `angle` (Burrow, Sunbeam and Gust Fan),
  `target` (tap
  the map: Balloon Drop, Storm Bolt, Tunnel Hop) or `use`. Ammo per team starts at `ammo` (-1 is
  unlimited: Acorn Rocket, Pebble Grenade, Paw Swipe, Burrow, Skip Turn). What each does is in
  `World.fire`, `World.use`, `stepShot`, `contact` and `goOff` (`game/world.ts`), all stepped at a
  fixed `DT` of 1/60 s. Blasts (`explode`) carve the ground, hurt by distance (full at the centre,
  at least 30% in reach), throw moles, set off mines, crates and loose explosives and put out
  nearby flames.
  The Sap Bomb (`sap`) sticks where it touches (riding on a mole it hit, `Shot.target`) and goes off
  2 s later; the Gust Fan (`gust`) knocks moles, kegs and loose bombs in a cone away, with no damage.
- **Moles:** `Mole` in `game/world.ts` (health `hp` up to `maxHp`, 100 unless the Quartermaster's
  helmets add to it): feet at `y` on the first earth pixel, walking up steps of 5
  px, jumps (`jump`, Enter) and backflips (Backspace), an `act` for actions that hold it (`dig`,
  `hop`, `pound`, `die`, and the short `swipe`, `throw`, `recoil` and `cheer` poses).
- **Burrow AI** (`game/ai.ts`): picks the weakest enemy, uses Paw Swipe or Ground Pound when one is
  next to it, the Repair Kit below 40 health, now and then a Storm Bolt or Balloon Drop (aimed
  upwind for the drift), otherwise tries Acorn Rocket, Pebble Grenade and sometimes one special over
  a grid of angles and powers with the game's own `flight`, scoring the miss, with big penalties for
  hurting itself or a friend. A shot whose blast reaches a powder keg next to an enemy scores as a
  hit (and as a self or friendly hit if the keg is next to its own side). With no shot within 170
  px it walks towards the target once and plans
  again. `aimError` from the difficulty (`byLevel(2.4, 1, 0.35)`) shakes the chosen angle and
  power.
- **Difficulty:** the AI's aim error above, and the aim preview while dragging or charging:
  `byLevel(3, 0.75, 0)` seconds of the path (Easy all of it, Normal its start, Hard none).
  `byLevel` and `difficulty()` (`game/options.ts`) follow the game's own Difficulty option, or the
  hub's when it is left on "Hub setting"; the game never calls the shared `byDifficulty`.
- **Options** (`game/options.ts`, the menu's Options panel, `showOptions`): Difficulty (Hub, Easy,
  Normal, Hard), Turn time for quick matches (`TURN_CHOICES`, 30 s by default; the campaign keeps
  30 plus its upgrades and the daily its own), Crates in quick matches (`CRATE_ODDS`, Normal is the
  40% chance) and Weather on or off. The defaults keep the hub's difficulty, 30 s turns and the 40% crates;
  weather is on.
- **Weather** (`weather` in the scene): rolled at the start of a quick or campaign match when the
  option is on (60% clear, 15% rain, 15% fog, 10% gusts, from one `Math.random` in `startMatch`),
  never in the daily range, and never gusts in a battle with a strong or calm wind (it stays clear). Rain (`World.rain`) puts fires out twice as fast and draws streaks,
  fog halves the aim preview and draws drifting banks (held still with reduced motion), gusts shift
  the wind once in the middle of a turn. The wind panel names it (`weather_<id>`).
- **Hats** (`game/hats.ts`): seven hats for your moles, each opened by a number of campaign stars
  (normal plus Veteran), picked on the Hats screen (`showHats`) from the Campaign screen. The pick
  (`hat` in prefs) is worn by team 0 (both teams in Two players), never in Watch AI.
- **Layout:** fills the screen (`setupScaling(game, { fill: true })`); the world is exactly the view,
  with no scrolling. The corner buttons sit top left (`corner: 'top-left'`) and the left team panel
  starts at `LEFT_PANEL` to stay clear of them. The bottom bar holds the weapon button (bottom
  left), ◀ ▶, ⤴ and FIRE (bottom right), whose label follows the weapon's mode (FIRE, TAP MAP, USE). FIRE is held like Space for an aimed
  weapon (`onFireButton`, `fireHeld`): it charges while held and fires on release or at full power;
  a quick tap fires at 60%.
- **Trophies** (`src/trophies/`): `firstHit` (hurt an enemy), `crate`, `splash` (an enemy into the
  water), `firstWin` (beat the AI), `triple` (three enemies hurt in one turn), `longShot` (a rocket
  hit more than 500 px from where it was fired), `arsenal` (15 weapons used), `flawless` (beat the
  AI losing no mole), `hardWin` (beat the AI on Hard) and the hidden `allWeapons` (all 28 used).
  Turn trophies come from `World.log` at the end of each human turn; none in Watch AI.

## Architecture

- `GameScene` is the only scene. `screen` is `menu`, `play` or `over`; `phase` is `aim`, `retreat`,
  `settle` or `over`. `update` runs `tick` (one `World.step` plus the turn logic) as many times as
  the frame's time holds `DT` (times `watchSteps()` in watch mode), then `render` draws.
- `buildWorld` makes the map, `World`, the sky (`paintSky`) and the ground (`TerrainArt`) for the menu
  and every match. The menu is a live map with idle moles behind its panel.
- `Terrain` (`game/terrain.ts`) is a byte mask; every `carve` and `add` is pushed to `ops`, which
  `TerrainArt.sync` replays on its canvas (a crater gets a scorched rim). `back` is the mask before
  the caves, painted as the dark back wall behind the earth.
- Drawing is all Phaser Graphics (`scenes/draw.ts`): `drawMole` picks the pose from the mole's state
  and `act`, with the weapon it holds while aiming (`drawProp`); `drawShotShape` draws every shell,
  also for the weapon icons (`drawWeaponIcon`) and the props. Particles (`World.particles`, kinds in
  `ParticleKind`) are drawn by `drawParticle`. Nothing in drawing uses `Math.random`.
- Input: a press within 44 px of the active mole starts the slingshot drag (`onDown`, `onMove`,
  `onUp`); any other press walks there, or picks the target for a `target` weapon. Buttons are made
  by `button(id, ...)` and recorded in `buttons[id]` (middle and size in world pixels, which are
  the view's except in the daily range, where `state.offset` is added).
- Sound goes out of `World` through `Hooks.sound` and the camera shake through `Hooks.shake`
  (skipped with reduced motion). With reduced motion `render` also draws with the time held at 0
  (`still`), so blinking mines, flickers and the Storm Bolt's flash hold still, and skips the
  flash of each blast.

## Save keys

- `burrow-brigade-stats`: `{ games, wins, used }`, matches started (not in Watch AI), wins against the
  AI and the weapons the player has used.
- `burrow-brigade-prefs`: `{ size, hat, options }`, moles a team, the hat worn (or null) and the
  Options panel's choices (`cleanOptions` checks each).
- `burrow-brigade-campaign`: `{ stars, vstars, acorns, levels }`, the best stars (0 to 3) of each
  campaign battle by its place in `BATTLES` (`vstars` for the Veteran tier), the acorns to spend and the Quartermaster's levels by id.
- `burrow-brigade-daily`: the daily range's record (`shared/daily.ts`).
- `burrow-brigade-trophies`: the shared trophies.

## Test hooks

- `window.game` (dev build). `scene.state` gives `screen`, `phase`, `mode`, `turn`, `turns`,
  `wind`, `weapon`, `active` (`id`, `team`, `x`, `y`, `hp`, `alive`), `craters`, `shots`, `busy`,
  `teams` (`alive`, `hp`), `winner`, `arsenal`, `battle` (the campaign battle, or null), `stars`
  (the campaign's best stars), `veteran`, `vstars`, `acorns`, `dailyScore` (the daily range's score once it ends), `offset` (where the daily range's map sits in the view, 0 otherwise), `difficulty` (the one in force), `weather`, `hat` and `view` (the view's size, to turn view pixels into
  page pixels). `scene.buttons` has every button by id: `play-ai`, `campaign`, `play-duo`, `daily`,
  `size-down`, `size-up`, `weapon`, `left`, `right`, `jump`, `fire`, `rematch`, `menu`, `w-<id>`
  for the arsenal's tiles while it is open, `battle-<i>`, `depot`, `back` and (once the
  last battle is won) `tier` on the Campaign screen, `buy-<id>` and `back` at the Quartermaster, `options` on the menu and `opt-<key>-left`/`-right` and
  `back` on its panel, `hats` on the Campaign screen and `hat-<id>` (`hat-none`) and `back` on its, and `next` on a won battle's result.
- The playthrough (`e2e/playthrough.spec.ts`) plays the first round: Play the Burrow AI, hold ▶,
  drag back from the mole to fire an Acorn Rocket, see a crater, wait through the AI's turn until
  the next blue mole is up, and checks the saved stats.

## Sound

`src/audio.ts`: the song has `calm` (menu), `battle` (a match) and the `win` and `lose` stings. The
effects in `SFX`, by name in `Sfx` (`game/world.ts`): `launch`, `throw`, `boom`, `bigBoom`,
`smallBoom`, `bounce`, `boing`, `splash`, `fuse`, `beep`, `buzz`, `zap`, `thunder`, `beam`, `dig`,
`jump`, `land`, `hurt`, `shield`, `heal`, `quake`, `pop`, `whoosh`, `thud`, `crack`, `split`,
`sizzle`, `poof`, `collect`, `balloon`, and `tick` for a turn's last five seconds (played by the
scene).

## Common changes

- **A new weapon:** add its id to `WEAPON_IDS` and `WEAPONS` (mode, group, ammo, speed, wind, radius,
  damage), its look to `drawShotShape` or `drawWeaponIcon`, what it does to `World.fire` or
  `World.use` and, for a shell, `contact` and `goOff`, its `w_<id>` and `d_<id>` texts in
  `i18n/en.ts` and `de.ts`, and its row to the README's table. Mark `ai: true` only if `planTurn`
  can aim it. The trophy texts name the number of weapons (28).
- **A theme:** add it to `Theme['id']` and `THEMES` (`game/terrain.ts`) and its colour to the
  campaign screen's `swatch`.
- **A campaign battle:** add it to `BATTLES` (its id to `BattleId`), with its `c_<id>` and
  `cd_<id>` texts in `i18n/en.ts` and `de.ts`. Saved stars go by place, so add new battles at the
  end.
- **A Quartermaster upgrade:** add its id to `UPGRADE_IDS` with its prices in `UPGRADE_COSTS`, what
  it does to `boosts` and where the scene uses `this.boost`, and its `u_<id>` and `ud_<id>` texts.
- **Balance:** blast radius and damage are in `goOff`; the turn and retreat times, sudden death and
  crate odds at the top of `GameScene.ts`; gravity, wind and the water's height in `terrain.ts`.
