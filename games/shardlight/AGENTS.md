# Shardlight: guide for agents

A block breaker in a chapel of stained glass, with a map of 30 windows. Read this before changing
the game, and keep it up to date in the same PR as the change (see the root `AGENTS.md`).

## Current state

- **Screens:** one scene, `GameScene`, with `screen` `map` or `play`. The map shows the 5 chapels
  (`CHAPEL_IDS` in `game/levels.ts`) along the top and the 30 windows as nodes on a winding path
  (`nodeSpots`): down the first chapel's column, up the next and so on. A node opens once the
  window before it is restored (`isOpen`); the next one to play glows. The **Workshop** opens as a
  panel over the map (`showWorkshop`), **Bar glass** opens the glass panel (`showGlass`), and
  **Daily window** starts the daily. **Clerestory** (top left, dim until all 30 windows are
  restored) starts an endless run (`startEndless`). A node whose feat is done wears a gold seal.
- **Windows** (`game/levels.ts`): `windowSpec(index)` makes the panes from the window's number with a
  seeded random, so a window is always the same. Window 0 is a fixed block of 24 plain panes, so a
  first round is short. The others pick one of `PATTERNS` (windows 1 and 2 take patterns 1 and 2),
  with more rows and more thick and lead panes chapel by chapel; lead panes sit only above the last
  two rows. From chapel 3 (Forest) one to three rows slide (`slide`). The 6th window of each chapel
  is a rose window (`roseWindow`): a heart pane (3 hits) in a ring of panes that turns (`orbit`),
  two rings from chapel 3, shoulders of plain panes at the sides (with a bell in each from chapel 3)
  and the chapel's **guardians** (`GUARDIANS`): a gargoyle (3 hits) drifting along the top in Dawn
  and the Forest, a stone owl (4 hits) swaying under the heart in the Fishers' and the Moon, both in
  the Sun Cathedral. They move by `slide`. While one stands the heart takes no harm (`guarded`,
  the orb rings off it with a `shield` event and a ward is drawn round it). **New panes**
  (`NEW_PANES`), a few among the glass from their chapel on: `mirror` (2 hits, Fishers' on) throws
  falling beads back up, `bell` (1, Forest on, only where rows slide) stops the sliding rows,
  rings and guardians for `BELL_SECONDS` (4), `prism` (1, Moon on) splits the orb that breaks it in
  two. Chapel 1 (Dawn) has none, so windows 0 to 4 are as before. The orb is 5% faster per chapel
  (`speed`). The daily is `windowSpec(-1, dailyRand('shardlight'), 2)`.
- **Feats** (`featOf`): every window has one, shown under the bar: the rose windows `heart` (all
  three heart hits in one chain), the others in turn `quick` (restored in under `QUICK_SECONDS`, 60
  s of play), `noBeads` (catch none) and `chain` (a chain of `featChain` = 6 + chapel panes).
  Window 0's is `quick`. A won window whose feat is done pays a seal once (`progress.feats`); the
  result box says so. Seals (`sealCount`) open the **bar glass** (`GLASSES` in `game/save.ts`:
  brass, then ruby at 2 seals, sapphire 5, emerald 9, amber 14, rose window 20), never spent; the
  glass is drawn by `drawBar` (`GLASS_COLOURS`).
- **Clerestory** (`endlessSpec(n)`): once every window is restored, an endless run of generated
  windows, the chapels' looks in turn, every 6th a rose window, as hard as the Sun Cathedral and
  3% faster each window (1.2 to 1.8 times). The orbs left carry from window to window (at most 9);
  losing them ends the run. Scored by windows restored in a row (`progress.endlessBest`). Its
  windows are `windowIndex` 30 and on, with `endless` holding the run; no stars or feats.
- **Play** (`game/sim.ts`): `Sim` moves everything in 4 ms steps (`step`), in field pixels (768
  wide, the bar 36 above the field's floor). An orb leaves the bar at up to 60° from straight up
  (`MAX_BOUNCE`), by where it hit. **Bar spin:** the bar's speed (`barVel`) is measured over the
  last 80 ms (`SPIN_TICKS`); a bar hit while it moves faster than `SPIN_MIN` (90 px/s) gives the
  orb a `spin` (full at 1000 px/s) that turns its path towards the bar's way, fading over about a
  second and never flatter than 70° from upright (`curve`). A still bar bounces as before. A
  spinning orb leaves a fading trail (`trails` in the scene). Panes: `glass` 1 hit, `thick` 2, `bead` 1 and always drops a
  bead, `heart` 3, `lead` never (only a fire orb breaks it) and is not needed to win. Other panes
  drop a bead with chance `dropChance` (8%). Beads (`BeadKind`): `wide` (bar ×1.4), `multi` (each
  orb becomes three, at most 9), `sticky` (the next 5 bar touches catch the orb), `fire` (burns
  through panes), `slow` (×0.72), `life` (+1 orb), and the bad `short` (bar ×0.65) and `fast`
  (×1.3). The orb speeds up by 0.8% per bar hit, at most 20%, until an orb is lost. Score: 10 per
  pane (30 lead, 50 a guardian, 100 heart) times the chain (`combo`, panes since the orb last touched the bar, at
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
  every window of a chapel), `allChapels` (all 30 restored) and `clerestory` (5 clerestory windows
  in a row).
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

- `shardlight-progress`: `{ stars: number[30], best: number[30], lead, upgrades: { wide, orb, magnet, charm }, beads, feats: number[30], glass, endlessBest }`.
- `shardlight-daily`: kept by `shared/daily.ts`.
- `shardlight-trophies`: kept by `shared/trophies.ts`.

## Test hooks

The dev build puts `game` on `window`; the playthrough reads `game.scene.getScene('Game')`:

- `state`: `screen`, `window`, `workshop`, `glassPanel`, `stars`, `lead`, `feats`, `seals`,
  `glass`, `endless` (the run, or null), `endlessBest`, and `play` while a window is on: `left`,
  `score`, `lives`, `result`, `barX`, `barY`, `barW`, `orbs` (`x`, `y`, `vx`, `vy`, `held`,
  `spin`), `spins` (spin shots so far), `feat` and `panes` (the panes still to break), all in field
  pixels.
- `field`: the field's top left and size in view pixels.
- `buttons`: every button by id (`window-0` and the other open nodes, `workshop`, `daily`, `buy-wide`
  and the others, `glass`, `glass-<id>`, `endless`, `close`, `map`, `result-map`, `result-next`,
  `result-retry`).

The playthrough clicks `window-0`, launches with a click, and steers the bar with mouse moves to
where the lowest falling orb will land, off-centre so the orb flies back at the lowest pane left.
On the orb's first return it plays a spin shot: the bar waits 40 to the right in the frame before
and sweeps onto its spot in the last frame, and the test checks the orb leaves with a spin (`spins`
1, `spin` below -0.3). Window 0 is restored with no orb lost (three stars, the `firstPane`,
`firstWindow` and `flawless` trophies) and in under a minute (its feat's seal), and the map then
shows `window-1`.

## Sound

`src/audio.ts`: a chapel tune in F (`calm`) on the map, a brisker `battle` part in a window, a
darker `boss` part in a rose window, and `win` and `lose` stings. Effects: `bar` and `wall`
bounces, `shatter` (higher along a chain) with a `tinkle`, `crack` for a thick pane, `clang` off
lead, `drop` when a bead falls, `catch` and `curse` for good and bad beads, `launch` and `lost`,
`spin` with a bar hit that spins the orb, `shield` off a guarded heart, `bell`, `prism` and
`mirror` (a bead thrown back up).
Buttons play the shared `click`, a purchase `coin`, and a refused purchase or a daily already
played `refuse`.

## Common changes

- **A new pane kind:** add it to `PaneKind` and `HITS` (and `TOUGH` if fire shouldn't burn it), give
  it a place in `gridWindow` (`NEW_PANES` with its first chapel), and draw it in `drawPane`.
- **A new feat:** add it to `FeatId`, `featOf`, `featMet` in the scene and a `feat-<id>` text.
- **A new bar glass:** add it to `GlassId`, `GLASSES` (seals needed), `GLASS_COLOURS` and a
  `glass-<id>` text.
- **A new bead:** add it to `BeadKind`, `BEAD_KINDS`, `BEAD_WEIGHTS` (and `BEAD_SECONDS` if timed),
  handle it in `catchBead`, draw its sign in `drawBead` and name it (`bead-<kind>`) in the texts.
- **Window 0** is what the playthrough plays: changing it, the bar, the orb speed on Normal or the
  bounce (or the bar spin) means checking the playthrough still restores it with no orb lost.
