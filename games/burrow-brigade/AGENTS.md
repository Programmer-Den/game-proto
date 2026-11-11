# Burrow Brigade: guide for agents

Turn-based artillery with squads of helmeted moles on destructible hills. Read this before changing
the game, and keep it up to date in the same PR as the change (see the root `AGENTS.md`).

## Current state

- **Modes:** Play the Burrow AI (you are Blue Burrow, team 0, and go first), Two players on one
  screen, and Watch AI (`?watch`, both teams run by the AI, a new match four seconds after one
  ends). Teams have 2 to 5 moles (`size` in `burrow-brigade-prefs`, 3 by default), picked on the
  menu. There is no save of a match under way.
- **Campaign** (`game/campaign.ts`): eight battles (`BATTLES`) against rival burrows, played from
  the menu's Campaign screen (`showCampaign`, a card per battle). Each has a set theme, its own team
  sizes (`mine` against `foes`, ignoring the menu's size), an aim multiplier for the AI (`aim`), a
  `habit` (a weapon the rival carries `bonus` extra uses of and reaches for first, through
  `planTurn`'s `habit`), and sometimes a twist (`wind` strong or calm, an early `suddenDeath`).
  It plays as `mode` `ai` with `battle` set. A win gives up to three stars (`starsFor`): the win,
  within `par` turns, and no mole lost; the best per battle is saved, and a battle opens once the
  one before it is won (`isOpen`). The result screen shows the stars and Next battle. The rival's
  name (`c_<id>`) replaces Amber Burrow in its panel; its card line is `cd_<id>`.
- **Map:** `generate` (`game/terrain.ts`) makes a fresh map for the view's size each match: rolling
  hills from four sine waves, a ridge in the middle, cliffs into the water at both ends, sometimes a
  water gap splitting the land, 2 to 4 caves and 1 or 2 floating ledges. One of three themes
  (`THEMES`: meadow, autumn, frost) is picked at random. `spawnPoints` puts team 0 on the left half
  and team 1 on the right. The water sits `WATER_GAP` (30) above the bottom; a mole or shell in it
  is gone.
- **Turns:** `TURN_TIME` (30 s) to walk, aim and use one weapon, then `RETREAT_TIME` (3 s) to keep
  walking, then `settle` waits for the world to be still (`World.busy`), plays the deaths of moles at
  0 health (each becomes a molehill with a team flag) and ends the turn. Each turn has a new wind
  from -10 to 10 (calm 15% of the time). After a turn a crate falls 40% of the time (30% of those
  heal 25, the rest hold one weapon from `CRATE_WEAPONS`). From turn `SUDDEN_DEATH_TURN` (24) the
  water rises 8 px a turn. Fall damage starts at a landing speed of 360 px/s.
- **Weapons:** 26 in `game/weapons.ts` (`WEAPON_IDS`, grouped `rocket`, `throw`, `strike`, `close`,
  `tool`), each with a `mode`: `aim` (angle and power), `angle` (Burrow and Sunbeam), `target` (tap
  the map: Balloon Drop, Storm Bolt, Tunnel Hop) or `use`. Ammo per team starts at `ammo` (-1 is
  unlimited: Acorn Rocket, Pebble Grenade, Paw Swipe, Burrow, Skip Turn). What each does is in
  `World.fire`, `World.use`, `stepShot`, `contact` and `goOff` (`game/world.ts`), all stepped at a
  fixed `DT` of 1/60 s. Blasts (`explode`) carve the ground, hurt by distance (full at the centre,
  at least 30% in reach), throw moles, set off mines, crates and loose explosives and put out
  nearby flames.
- **Moles:** `Mole` in `game/world.ts`: feet at `y` on the first earth pixel, walking up steps of 5
  px, jumps (`jump`, Enter) and backflips (Backspace), an `act` for actions that hold it (`dig`,
  `hop`, `pound`, `die`, and the short `swipe`, `throw`, `recoil` and `cheer` poses).
- **Burrow AI** (`game/ai.ts`): picks the weakest enemy, uses Paw Swipe or Ground Pound when one is
  next to it, the Repair Kit below 40 health, now and then a Storm Bolt or Balloon Drop (aimed
  upwind for the drift), otherwise tries Acorn Rocket, Pebble Grenade and sometimes one special over
  a grid of angles and powers with the game's own `flight`, scoring the miss, with big penalties for
  hurting itself or a friend. With no shot within 170 px it walks towards the target once and plans
  again. `aimError` from the difficulty (`byDifficulty(2.4, 1, 0.35)`) shakes the chosen angle and
  power.
- **Difficulty:** the AI's aim error above, and the aim preview while dragging or charging:
  `byDifficulty(3, 0.75, 0)` seconds of the path (Easy all of it, Normal its start, Hard none).
- **Layout:** fills the screen (`setupScaling(game, { fill: true })`); the world is exactly the view,
  with no scrolling. The corner buttons sit top left (`corner: 'top-left'`) and the left team panel
  starts at `LEFT_PANEL` to stay clear of them. The bottom bar holds the weapon button (bottom
  left), ◀ ▶, ⤴ and FIRE (bottom right), whose label follows the weapon's mode (FIRE, TAP MAP, USE).
- **Trophies** (`src/trophies/`): `firstHit` (hurt an enemy), `crate`, `splash` (an enemy into the
  water), `firstWin` (beat the AI), `triple` (three enemies hurt in one turn), `longShot` (a rocket
  hit more than 500 px from where it was fired), `arsenal` (15 weapons used), `flawless` (beat the
  AI losing no mole), `hardWin` (beat the AI on Hard) and the hidden `allWeapons` (all 26 used).
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
  by `button(id, ...)` and recorded in `buttons[id]` (middle and size in view pixels).
- Sound goes out of `World` through `Hooks.sound` and the camera shake through `Hooks.shake`
  (skipped with reduced motion).

## Save keys

- `burrow-brigade-stats`: `{ games, wins, used }`, matches started (not in Watch AI), wins against the
  AI and the weapons the player has used.
- `burrow-brigade-prefs`: `{ size }`, moles a team.
- `burrow-brigade-campaign`: `{ stars }`, the best stars (0 to 3) of each campaign battle, by its
  place in `BATTLES`.
- `burrow-brigade-trophies`: the shared trophies.

## Test hooks

- `window.game` (dev build). `scene.state` gives `screen`, `phase`, `mode`, `turn`, `turns`,
  `wind`, `weapon`, `active` (`id`, `team`, `x`, `y`, `hp`, `alive`), `craters`, `shots`, `busy`,
  `teams` (`alive`, `hp`), `winner`, `arsenal`, `battle` (the campaign battle, or null), `stars`
  (the campaign's best stars) and `view` (the view's size, to turn view pixels into
  page pixels). `scene.buttons` has every button by id: `play-ai`, `campaign`, `play-duo`,
  `size-down`, `size-up`, `weapon`, `left`, `right`, `jump`, `fire`, `rematch`, `menu`, `w-<id>`
  for the arsenal's tiles while it is open, `battle-<i>` and `back` on the Campaign screen, and
  `next` on a won battle's result.
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
  can aim it. The trophy texts name the number of weapons (26).
- **A campaign battle:** add it to `BATTLES` (its id to `BattleId`), with its `c_<id>` and
  `cd_<id>` texts in `i18n/en.ts` and `de.ts`. Saved stars go by place, so add new battles at the
  end.
- **Balance:** blast radius and damage are in `goOff`; the turn and retreat times, sudden death and
  crate odds at the top of `GameScene.ts`; gravity, wind and the water's height in `terrain.ts`.
