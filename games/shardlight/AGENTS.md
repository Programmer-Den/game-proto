# Shardlight: guide for agents

A block breaker in a chapel of stained glass, with a map of 30 windows. Read this before changing
the game, and keep it up to date in the same PR as the change (see the root `AGENTS.md`).

## Current state

- **Screens:** one scene, `GameScene`, with `screen` `map` or `play`. The map shows the 5 chapels
  (`CHAPEL_IDS` in `game/levels.ts`) along the top and the 30 windows as nodes on a winding path
  (`nodeSpots`): down the first chapel's column, up the next and so on. A node opens once the
  window before it is restored (`isOpen`); the next one to play glows. The **Workshop** opens as a
  panel over the map (`showWorkshop`), and **Daily window** starts the daily.
- **Windows** (`game/levels.ts`): `windowSpec(index)` makes the panes from the window's number with a
  seeded random, so a window is always the same. Window 0 is a fixed block of 24 plain panes, so a
  first round is short. The others pick one of `PATTERNS` (windows 1 and 2 take patterns 1 and 2),
  with more rows and more thick and lead panes chapel by chapel; lead panes sit only above the last
  two rows. From chapel 3 (Forest) one to three rows slide (`slide`). The 6th window of each chapel
  is a rose window (`roseWindow`): a heart pane (3 hits) in a ring of panes that turns (`orbit`),
  two rings from chapel 3, and shoulders of plain panes at the sides. The orb is 5% faster per
  chapel (`speed`). The daily is `windowSpec(-1, dailyRand('shardlight'), 2)`.
- **Play** (`game/sim.ts`): `Sim` moves everything in 4 ms steps (`step`), in field pixels (768
  wide, the bar 36 above the field's floor). An orb leaves the bar at up to 60° from straight up
  (`MAX_BOUNCE`), by where it hit. Panes: `glass` 1 hit, `thick` 2, `bead` 1 and always drops a
  bead, `heart` 3, `lead` never (only a fire orb breaks it) and is not needed to win. Other panes
  drop a bead with chance `dropChance` (8%). Beads (`BeadKind`): `wide` (bar ×1.4), `multi` (each
  orb becomes three, at most 9), `sticky` (the next 5 bar touches catch the orb), `fire` (burns
  through panes), `slow` (×0.72), `life` (+1 orb), and the bad `short` (bar ×0.65) and `fast`
  (×1.3). The orb speeds up by 0.8% per bar hit, at most 20%, until an orb is lost. Score: 10 per
  pane (30 lead, 100 heart) times the chain (`combo`, panes since the orb last touched the bar, at
  most 10).
- **End of a window:** won when every pane but lead is broken; lost when the last orb falls with
  none left. Stars: 3 with no orb lost, 2 with one, else 1. Lead: panes broken + 10 + 5 per star for
  a win, half the panes broken for a loss. The result box offers the map and the next window (or a
  retry).
- **Picture:** each chapel has a picture (`PICTURES` in `scenes/art.ts`: dawn, a ship, a fox in the
  forest, the moon, a sun rose), varied per window. It is drawn behind the panes, dim at first and
  brighter as panes break; every shape is held inside the picture's frame (`bounds`).
- **Difficulty** (`byDifficulty`): orb speed 320 / 380 / 450 and bar width 132 / 110 / 92.
- **Upgrades** (`UPGRADES` in `game/save.ts`): `wide` (3 levels, +12 bar), `orb` (2, +1 orb),
  `magnet` (2, beads drift to the bar), `charm` (2, good beads last 25% longer each).
- **Trophies** (`src/trophies/`): `firstPane`, `firstWindow`, `beads` (10 beads caught in all),
  `flawless` (a window with no orb lost), `triple` (3 orbs at once), `chain` (`CHAIN` = 8 panes
  in one chain), `firstChapel` (window 6, the first rose), the hidden `allStars` (three stars on
  every window of a chapel) and `allChapels` (all 30 restored).
- **Layout:** fills the screen (`setupScaling(game, { fill: true })`). The field is 768 wide,
  centred, from `FIELD_TOP` to the view's floor; a taller view gives a taller field. The orbs left
  are drawn down the left side, timed beads listed down the right. The corner buttons sit top
  right (`setupGame(..., { corner: 'top-right' })`).
- **Reduce motion:** no flash when a window is restored and the map's next node does not pulse.

## Architecture

- `GameScene.clear()` destroys every object, stops tweens and timers and bumps `gen`, so a
  delayed result box from a window that was left does nothing.
- In play, `update` reads the keys, calls `sim.step(delta)`, plays the sim's `events` (sound, shards,
  trophies) and redraws the panes (`paneGfx`) and the moving parts (`dynGfx`) every frame. The
  pointer moves the bar on `pointermove`; a tap on the field moves it there and calls `launch`.
- Buttons are `button(id, ...)`, recorded in `buttons[id]` (middle and size in view pixels) for the
  playthrough. Map nodes are `window-<i>`.

## Save keys

- `shardlight-progress`: `{ stars: number[30], best: number[30], lead, upgrades: { wide, orb, magnet, charm }, beads }`.
- `shardlight-daily`: kept by `shared/daily.ts`.
- `shardlight-trophies`: kept by `shared/trophies.ts`.

## Test hooks

The dev build puts `game` on `window`; the playthrough reads `game.scene.getScene('Game')`:

- `state`: `screen`, `window`, `workshop`, `stars`, `lead`, and `play` while a window is on: `left`,
  `score`, `lives`, `result`, `barX`, `barY`, `barW`, `orbs` (`x`, `y`, `vx`, `vy`, `held`) and
  `panes` (the panes still to break), all in field pixels.
- `field`: the field's top left and size in view pixels.
- `buttons`: every button by id (`window-0` and the other open nodes, `workshop`, `daily`, `buy-wide`
  and the others, `close`, `map`, `result-map`, `result-next`, `result-retry`).

The playthrough clicks `window-0`, launches with a click, and steers the bar with mouse moves to
where the lowest falling orb will land, off-centre so the orb flies back at the lowest pane left.
Window 0 is restored with no orb lost (three stars, the `firstPane`, `firstWindow` and `flawless`
trophies), and the map then shows `window-1`.

## Sound

`src/audio.ts`: a chapel tune in F (`calm`) on the map, a brisker `battle` part in a window, a
darker `boss` part in a rose window, and `win` and `lose` stings. Effects: `bar` and `wall`
bounces, `shatter` (higher along a chain) with a `tinkle`, `crack` for a thick pane, `clang` off
lead, `drop` when a bead falls, `catch` and `curse` for good and bad beads, `launch` and `lost`.
Buttons play the shared `click`, a purchase `coin`, and a refused purchase or a daily already
played `refuse`.

## Common changes

- **A new pane kind:** add it to `PaneKind` and `HITS`, give it a place in `gridWindow`, and draw it
  in `drawPane`.
- **A new bead:** add it to `BeadKind`, `BEAD_KINDS`, `BEAD_WEIGHTS` (and `BEAD_SECONDS` if timed),
  handle it in `catchBead`, draw its sign in `drawBead` and name it (`bead-<kind>`) in the texts.
- **Window 0** is what the playthrough plays: changing it, the bar, the orb speed on Normal or the
  bounce means checking the playthrough still restores it with no orb lost.
