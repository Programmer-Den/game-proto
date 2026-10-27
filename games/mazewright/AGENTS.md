# Mazewright: guide for agents

How Mazewright is built and where things stand, for agents changing it. README.md covers how to
play, the towers, the foes and the gardens. Keep this file up to date with any change to the game,
per the root AGENTS.md.

## Current state

Mazewright is a maze-building tower defense in a Hedge Garden look, drawn in flat vector shapes
(clean fills, soft drop shadows, no outlines). There is no road: foes walk from a burrow to the
cottage by the shortest free way across a 22x11 grid, and every hedge and tower is a wall. The core
rule is that a free route always remains: a placement is refused when it would leave any burrow,
or any foe on the ground, without a way to the cottage.

Implemented today:

- Twelve gardens (`MAPS`), three a season (`MapDef.season`, `SEASONS`): spring's Meadow, Orchard
  and Millpond, summer's Brook, Warren and Gravel Walk, autumn's Hillside, Crossroads and Leaf Walk,
  winter's Ice Pond, Last Cabbage and Snow Path. Each has one to six burrows (`gates`, opening on
  the waves in `GATE_WAVES`: 1, 6, 10, 13, 15, 17), a cottage, rocks, and maybe `ponds` (water:
  walkers go round, moths and sunglass beams cross, nothing is planted), `banks` (a tower there
  reaches `BANK_REACH` (1.25) times further, `reachOf`), a `path` (a path garden: foes keep to the
  gravel, towers go only on the lawn beside it, which never changes a route) and its own `lives`
  (Last Cabbage: 1). The picker has a tab per season (`season-<season>` buttons); a season opens
  at `SEASON_STARS` (0, 4, 10, 18) stars won across all gardens, and a shut one's cards are dimmed
  and refuse a tap. Each season has its own lawn colours (`art.SEASON_LAWN`), and winter's water is
  ice. A greedy bot (each hedge where it lengthens the routes most, towers where they cover most
  route; for a path garden, towers on the lawn that covers most path) wins all twelve on Normal
  with a bow, frost and cannon pouch, weather included.
- Season weather (`WEATHER`, in `step`): in summer gardens `wilt` stops a tower that has fired
  nonstop (`busy`, no gap over `rest` since `lastShot`, set only when it really fires, not when a toadstool looks
  again for a foe to shrink) for `wiltAfter` (8) seconds for
  `wiltFor` (3), unless a grown frost tower's reach covers it; in winter gardens `frost` freezes a
  random firing tower no bonfire's reach covers every `frostEvery` (14) seconds of a wave, for
  `frostFor` (4). A `stopped` tower neither reloads, grows nor fires; events `wilt` and `frozen`,
  drawn with `art.wilted` and `art.frozen`, and the first of them each game gets a banner
  (`wiltFirst`, `frostFirst`). Spring and autumn have no weather.
- Two gardeners (`duo`, the `duo` button under the way of play, saved): `newGame(..., fixed, duo)`
  gives `g.duo`, a second purse `g.gold2` (`g.gold` is the left or only gardener's) and foes
  `DUO_TOUGHNESS` (1.3) times tougher. `sideOf(g, cell)` is 0 for the left half (`COLS / 2`
  columns) and 1 for the right; `goldAt` is that side's gold, and `canBuild`, `build`, `upgrade`,
  `sell` and the apple tree's pay use the cell's side. A kill pays the side where the foe was, and
  `share` splits the wave pay and early bonus (the odd coin to the poorer). The scene keeps
  `tool2` for the right half (`toolAt(cell)` picks the tool for a tap or the hover preview), draws
  `drawTools` once per gardener (`tool-<kind>` and `tool2-<kind>`, tower pictures in `icons` when
  narrow), moves the wave and speed buttons into the top bar by `gold2`, and draws a dashed line
  down the middle of the lawn. A greedy bot playing both halves wins the maze gardens about as
  often as one gardener does.
- Replays: a game draws its random numbers from its own seed (`rand`, mulberry32 on `g.rng`; frost
  and nothing else uses chance today) and fixes `toughness` and `lives` at the start, and
  `note` logs every player action (`Action`: build, upgrade, sell, turn, aim, wave) at the step it
  came (`g.steps`). The wave timer starts waves through `beginWave`, which isn't logged. A Classic
  or Swarm win is kept with `replayOf` as the garden's `Replay` (`saveReplay`); the card's
  `watch-<garden>` button starts `replayGame(r)`, and `GameScene.update` calls `replayStep` before
  each `step`, so the game plays out exactly as it did. A replay carries `REPLAY_VERSION` as `v`;
  `loadReplays` drops one of another version, or with a mode, tower or action it doesn't know. While `replay` is set, the board and keys
  take nothing but F, the bottom bar shows `replayLabel` and the speed button (1x, 2x, 4x;
  `faster`), and records, seeds and replays are left alone; the end panel has Watch again
  (`again`) and Gardens. Any new chance in the sim must use `rand(g)`, never `Math.random`, and any
  new player action must call `note`, or replays drift. Raise `REPLAY_VERSION` with any change that
  makes the same actions play out differently (balance numbers, rules).
- The pouch: under the garden cards, chips in two rows (`CHIPS.perRow`) for the thirteen towers and two traps besides `hedge` and `bow` (`ALWAYS`);
  up to `POUCH_PICKS` (4) are picked, saved, and make the run's tool bar (six buttons at most).
  `DEFAULT_POUCH` is today's four (hedge, bow, frost, cannon), which the playthrough uses.
- Towers (`TOWERS`), levels 1 to 3 and the master level `MASTER` (4; hedges stay at 1), sold for 70% of what they cost (`sellValue`; the whole price of a growth still under way, so a tower still growing gives back all it cost, and one growing an upgrade gives back that upgrade's price): `hedge`
  (blocks only), `bow`, `frost` (pulse, slows), `cannon` (splash, ground only), `storm` (a bolt that
  chains to foes within `jump` of each other), `crossbow` (long reach, aims at the toughest),
  `bonfire` (a cone the way it faces, sets ground foes burning), `puffball` (poison that spreads once
  to ground foes close by), `sunglass` (a beam along its row or column to the first blocked tile),
  `beehive` (towers on the 8 tiles round it reload faster; the best hive counts), `apple` (gold
  each held wave), `whirligig` (reload spins down from 0.6 s while it keeps firing), `swallow`
  (`airOnly`), `nettle` (pulses `stun` into ground foes in reach: `Foe.stunUntil` stops `moveFoe`)
  and `toadstool` (shrinks the foe it picks once: `shrink` of its health, `body` 0.8, a life less,
  `Foe.shrunk`). The master level costs `upgradeCost(kind, 3)` (4 times the cost), uses level 3's
  numbers (`tier`) and adds a trick from `MASTER_TRICKS`, each coded in `fire`, `boosts`,
  `moveShot` and the wave payout (`hurt`'s `pierce` skips shells; `Shot.pierce`, `Shot.knock`,
  `Foe.blueFlame`); the panel shows `${kind}Master` from level 3. Bonfire and
  sunglass `faces`: they first point where they cover most of the route (`bestFace`) and turn a
  quarter round from their panel (`turn`).
- Foes (`FOES`): `beetle`, `ladybird`, `stag`, `moth` (flies straight over the maze), `mole` (chews
  through one hedge in its life when that saves it at least `CHEW_GAIN` steps; towers and rocks are
  never chewed), the `weevil` (from wave 8), `woodlouse` (`splits` into two small ones),
  `earwig` (fastest), `snail` (rubbery shell, `heals` a share of its health a second unless chilled
  or poisoned), `ember` (shell `ember`: no Heat) and the `queen` (wave 10). On wave 20 the queen is
  the Empress (`EMPRESS`: lays a beetle every `egg` seconds, and every `turn` seconds takes the
  shell in `RESISTS` against the damage kind that hurt her most; event `shell`).
- Stolen cabbages: `lives` are the cabbages in the patch. A foe reaching the cottage `grab`s
  `min(f.lives, g.lives)` into `carry`, turns `home` and walks `homeDist[gate]` (a field to each
  burrow, made again with `dist` in `refield`) back; at its burrow they are lost (event `leak`). A
  beaten carrier `drop`s them as a `Loose` cabbage that `roll`s back along `dist` at `CABBAGE.speed`
  (straight, off a moth) and is picked up by any foe with free hands within `CABBAGE.reach`; back
  in the patch it adds to `lives` (event `saved`). `remaining` for a foe going home is its way to
  the burrow. The game is lost when `cabbagesLeft` is 0; building on a loose cabbage is refused
  like a foe.
- The potting shed (`Shed` in `save.ts`, the `shed` screen; each card tells what the buy brings:
  `◆ cost · ${kind}Text` while the tower is still to buy or a trap, `${kind}Master` after, and
  `slotInfo` under the slots): `seedsFor` pays a finished game
  (`SEEDS`), and `buy` spends them on towers (`towerSeeds`; `FREE` needs none), master levels
  (`masterSeeds`; `newGame`'s `masters` list, which `nextUpgrade` and `masterOpen` check; null in
  the sim means all, as the bot and tests use) and pouch slots (`SLOT_SEEDS`, `picksOf`). `pouchOf`
  keeps only `usable` towers. `loadShed` credits past records once, when the key is missing. The
  tool bar narrows its buttons when the pouch holds more than six.
- Ways of play (`MODES`, `Game.mode`, picked by the `mode` button on the picker): `classic`,
  `swarm` (the wave timer at 0 whatever Calm says, `SWARM_GOLD` on kill and wave gold through
  `pay`), `endless` and `sandbox` (`totalWaves` is Infinity: `waveGroups` repeats waves 11 to 20
  bigger each round; sandbox starts with `SANDBOX_GOLD` and towers grow at once). `stars` gives a
  won game one to three stars by `cabbagesLeft` (`STARS`) and four for a Swarm with none lost. The
  scene notes the records (`note`, `noteRecord` merges best of each; Sandbox keeps none) and the
  cards show stars and the best time, or the Endless best.
- Garden traps: `honey` and `snare` are pouch picks with `TowerDef.trap`. `build` puts them in
  `g.traps` (`Trap`), not `towers`: they never block, need no open way and may lie under foes
  (`canBuild`), and can't be upgraded or sold. `springTraps` (each `step`): a honey pot springs
  when a ground foe is within `TRAP.honey.lure`, makes `field` (a walking field to its cell, made
  again in `refield`) and sets `Foe.lure` on the ground foes in reach, which `moveFoe` follows
  instead of `dist`; after `TRAP.honey.for` seconds it bursts (blast and `stunUntil`). A snare
  catches the first ground foe whose `from` is its cell. Events `lured`, `burst`, `snared`.
- Kings and big foes: a `Group` may carry `{ king: true }` (`KING`: hp, gold, lives, body, speed;
  `KING_TRICKS`: a king mole chews 3 hedges, a king woodlouse splits into 4, a king moth lets 3
  moths go) or `{ size: 2 | 3 }` (`BIG`). `makeFoe` and `offspring` build foes; a `Foe` keeps its
  `body` (draw radius in tiles), `gold`, `lives`, `chews`, `splits` and `shell`. After the last
  wave's groups, `RUSH_KINDS` each send one king, `RUSH.delay` seconds later and `RUSH.gap` apart (event `rush`); events `king`, `split`, `egg`.
- Damage kinds (`DAMAGE_KINDS`, a tower's `hits`) and shells (`SHELLS`, a foe's `shell`):
  `shellFactor` gives the share that gets through (stag waxy, mole hairy, weevil hard). Burning is
  Heat, poison goes through every shell. Sunglass and bonfire hits add `HEAT.hit` to a foe's `heat`
  (cooling by `HEAT.cool` a second); at 1 it takes `HEAT.boost` times Heat damage.
- Aim (`AIMS`, a tower's `target`): first, last, strongest, weakest or fliers first, set from the
  panel for the towers where `aims(kind)` holds; a `TowerDef.aim` sets the start (crossbow:
  strongest). Sell asks for a second tap within 2 seconds.
- 20 waves (`WAVES`); each burrow is used from its wave in `GATE_WAVES` (`openGates`), with foes
  sent out of the open ones in turn, but every route must stay open all game. Wave 1 starts by hand (Start wave). After it, unless `calm` (the picker's
  toggle, saved), `nextAt` is set `WAVE_TIMER` (20) seconds after a wave is all out and `step`
  starts the next then; Start wave still sends it early, for `EARLY_BONUS` gold while foes are out (only by hand: a wave the timer starts pays no bonus).
- Growing (`GROW_RATE`): `build` and `upgrade` set a tower's `grow` (and `growFull`) to its cost
  over 10 seconds; `fire` only counts it down while it grows, and a growing beehive boosts nothing.
  The scene draws it faint with a filling ring.
- Building during a wave is allowed; a tile with a foe on it (or walking onto it) is refused.
- Building over a hedge: any tower but a hedge or trap may go on a hedge's tile (`hedgeUnder`).
  `canBuild` then only checks the gold, `costOn` is its cost less the hedge's `sellValue`, and
  `build` takes the hedge out (the cell stays blocked, so no `refield`) and drops a mole's `chew` of
  it. The new tower's `spent` is its full cost. The scene plants over a hedge on a tap or drag with a
  tower tool, so a hedge's panel opens only with the hedge tool (or Upgrade) picked.
- Upgrade and sell modes: the scene's `Tool` is a `TowerKind` or a `ToolMode` (`'upgrade'`,
  `'sell'`, `isMode`). The `tool-upgrade` and `tool-sell` buttons (and `tool2-...`) after each
  gardener's tools, or the U and S keys, pick one; picking it again goes back to the tower from
  before (`before`). Then a tap or drag on a tower calls `upgrade` or `sell` (no second tap; a tap
  that can't buzzes), a mark sits on each tower (gold up: can be upgraded now; cream down: sell
  mode), there is no hover preview, and the top bar tells `upgradeModeText` or `sellModeText`.
- Hover preview: the routes as they would be with the hovered tile planted, or the no-entry ring;
  made again when the board changes or a ground foe or loose cabbage moves on, and not shown while
  watching a replay.
- Drag to plant a line; keys 1 to 8 (the pouch, in order), U and S (upgrade and sell mode), Space and F; a 2x speed button. The
  picked tool's use is told in the top bar.
- Banners name each new foe kind the first time it comes, the second burrow (and each later one,
  `burrowOpens`), the first stolen
  cabbage (`grabbed`), a chewing mole, a king
  (`kingComing`), the final rush (`rush`) and the Empress's shell turns (`empressShell`). Kings
  wear a crown (`art.foe` with `king`).

Missing or rough:

- A game in play is not saved; a reload starts at the garden picker.
- No Watch AI mode, no upright layout (an upright phone gets the turn hint).
- Normal was made harder after the bot runs below: 15 cabbages instead of 20 and `HP_PER_WAVE` 0.2
  instead of 0.16 (wave 1 is unchanged). It has not been checked with the bot since.
- Balance was tuned with a scripted bot (a fixed serpentine on the Meadow): building only between
  waves it loses at the final queen on Normal, building during waves it wins with a few lives left
  (before stolen cabbages, which made every maze hold foes twice and the game easier).
  The new towers were checked one at a time beside a serpentine corridor for damage per gold:
  crossbow, cannon, bow, whirligig and puffball do most, the storm rod, bonfire and beehive less
  but need bunched foes, a straight corridor or neighbours to shine, and the sunglass needs a
  corridor in line with it. A tower's balance is a first pass.
- `docs/screenshots/gardens.webp` (the picker on its autumn tab, with the pouch), `path.webp` (Gravel Walk), `ponds.webp` (Ice Pond, towers on its banks), `wilt.webp` (Brook, a wilted cannon), `frost.webp` (Ice Pond, a frozen frost tower), `towers.webp`, `aim.webp`, `kings.webp`, `cabbages.webp`, `grow.webp`, `master.webp`, `traps.webp`, `shed.webp` (the shed's cards with their info lines), `modes.webp` (upgrade mode and its gold marks), `hedge-swap.webp` (a bow hovered over a hedge), `refund.webp` (a growing bow's panel, selling for all it cost), `maze.webp`,
  `mole.webp` and `cover.png` were taken by hand (a
  Playwright script that plants a maze and sends waves 8 and 9); `duo-replay.webp` (a
  two-gardener replay of the Meadow, both purses in the top bar) was made from a replay put in
  storage; `refused.webp` is the
  playthrough's `playthrough-2-refused` shot. Refresh them when the look changes.

## Architecture

File map (`src/`):

- `main.ts`: creates the `Phaser.Game` (960x540 from `VIEW`, `Phaser.Scale.FIT`) with `GameScene`,
  calls `setupGame(game, { howToPlay })` and then `setupScaling(game, { fill: true })`, and in dev
  builds puts `game` on `window`.
- `howToPlay.ts`: the How to play text in English (also US English) and German.
- `i18n.ts` and `i18n/`: the game's texts. `en.ts` is the British English source, `de.ts` the
  German (with `keepEnglish` for the title and Frost) and `en-US.ts` empty. Keys built from ids
  (`${map}Name`, `${map}Text`, `${tower}Name`, `${tower}Text`, `refuse_${reason}`, `new_${foe}`)
  must exist for every id.
- `audio.ts`: `SONG` and the `SFX` table (see Sound).
- `game/rules.ts`: `COLS`, `ROWS`, `TOWERS`/`TOWER` (cost, range, damage and reload by level, air,
  splash, slow, stun, shrink, airOnly), `MAX_LEVEL`, `MASTER`, `tier`, `MASTER_TRICKS`, `harms`, `SELL_BACK`, `upgradeCost`, `SHOT_SPEED`, `FOES`/`FOE` (hp, speed,
  gold, lives, gap, flies, digs, size), `CHEW_TIME`, `CHEW_GAIN`, `WAVES`, `GATE_WAVES`, `SECOND_GATE`, `BANK_REACH`,
  `GROUP_GAP`, `HP_PER_WAVE`, `FINAL_QUEEN`, `startLives`, `START_GOLD`, `hpScale`, `waveReward`,
  `EARLY_BONUS`, `ALWAYS`, `POUCH_PICKS`, `DEFAULT_POUCH`, `attacks`, `ShotKind`, `SPREAD`. A
  `TowerDef` carries the extra numbers of the towers that need them (`chain`/`jump`, `dot`/`dotFor`,
  `faces`/`cone`, `boost`, `apples`, `spinTo`/`spinUp`, `aim`), `DAMAGE_KINDS`, `SHELLS`,
  `shellFactor`, `HEAT`, `AIMS`, `aims`. No Phaser.
- `game/maps.ts`: `MAPS` (`MapDef`: `id`, `season`, `gates`, `goal`, `rocks`, and optional `ponds`,
  `banks`, `path`, `lives`; `line` and `block` spell paths and ponds), `SEASONS`, `SEASON_STARS`,
  `cellIndex`, `cellOf`, `inGrid`. A cell index is `row * COLS + col`.
- `game/grid.ts`: `distances` (breadth-first search out from the cottage over free cells, 4
  neighbours), `nextStep` (a neighbour one step closer, keeping the heading on ties, then right,
  down, up, left), `route`, `UNREACHABLE`, `DIRS`.
- `game/sim.ts`: `Game`, `Tower`, `Foe`, `Shot`, `GameEvent`, `Refusal` and the actions:
  `newGame`, `replayGame`, `replayStep`, `replayOf` (with `Action`, `Fixed` and `Replay`), `sideOf`, `goldAt`, `canBuild`, `hedgeUnder`, `costOn`, `wouldBlock`, `build`, `nextUpgrade`, `upgrade`, `sellValue`, `sell`, `turn`, `setAim`,
  `canStartWave`, `startWave`, `step`, `remaining`, `routeLength`, `towerAt`, and `beamCells`,
  `inCone` and `bestFace` for the towers that point one way, `reachOf` and `openGates`. Only this file
  changes a `Game`. `g.blocked` is 0 free (a path garden's path), 1 rock, 2 tower, 3 water, 4
  (`LAWN`) a path garden's lawn; `g.ground` is the same without towers (selling puts it back), and
  `g.banks` marks banks. `g.dist` (and `homeDist`, one per burrow) is made again whenever a cell
  is blocked or freed. A ground foe walks from `from` to `to` (neighbouring cells) with `t` from 0
  to 1, and picks its next cell from `g.dist` on arrival, so a maze changed mid-wave takes effect at
  its next step. `canBuild` refuses a tile in this order: `reserved` (a burrow or the cottage),
  `taken` (a rock, water or tower; the scene opens the tower's panel instead; a trap off the
  walking cells), a path garden's lawn is then only checked for `gold` and its path is `reserved`,
  then `foe`, `blocks` (the never-close rule: `open` checks every burrow, every ground foe's `to` cell and every
  rolling cabbage's `to` cell against the new field, so a loose cabbage can't be walled in) and `gold`. Towers pick a foe in reach by their aim (`pick`;
  First is the least `remaining` distance). `step` moves foes, then `afflict` (burning, poison and its
  spread, and cooling), then fires every tower with its beehive `boosts`; `hurt` takes a damage kind
  through the foe's shell, `scorch` is a heat hit that also heats. Apple trees pay out with the wave reward.
- `game/save.ts`: `loadRecords`, `noteRecord`, `loadPouch`, `savePouch`, `pouchOf` (hedge and bow,
  then up to four more in tower order, traps included), `loadShed`/`saveShed`, `usable`, `picksOf`,
  `loadMode`/`saveMode`, `loadReplays` (only valid replays of this `REPLAY_VERSION`), `saveReplay`,
  `loadCalm`/`saveCalm` and `loadDuo`/`saveDuo`.
- `scenes/layout.ts`: `VIEW`, `CELL` (40), `GRID` (the grid's corner in the 960x540 frame), the bar
  height, the tool, wave, speed and Gardens buttons, `TIP_X` (the tool's use in the top bar), the
  tower panel (taller with Turn), the garden cards, the pouch's `CHIPS` (two rows, above the corner buttons)
  and `DEPTH`.
- `scenes/art.ts`: `C` (colours), `FOE_COLOUR` and the drawing functions (`lawn`, `flowers`,
  `hedge`, `chewedHedge`, `rock`, `pond`, `bank`, `gravel`, `tower`, `burrow`, `cottage`, `foe`, `healthBar`, `dotted`,
  `dashedCircle`, `noEntry`), all on a Phaser Graphics at a cell's middle.
- `scenes/GameScene.ts`: the only scene. Screens `menu` (the garden picker) and `play`. It steps the
  game in fixed `STEP`s (1/60 s, times `speed`), drains `g.events` for sound, flashes and records,
  redraws the rocks, burrows and cottage when the board changes (`boardG`), everything that moves
  each frame (`fxG`: routes, towers, the hover preview, foes, shots, flashes) and the bars, buttons,
  tower panel, banner and end panel when what they show changes (`hudG` and texts). The lawn
  fills the whole view; the bars are pinned to its top and bottom and the grid sits in the middle of
  `viewFrame`. Tools start 176 pixels in, clear of the corner buttons.

Save keys: `mazewright-best` (per garden, `GardenRecord`: best wave, whether it was won, most
stars, fastest win in seconds and the Endless best), `mazewright-pouch` (the towers picked),
`mazewright-calm` (`'1'` when waves wait for Start wave), `mazewright-duo` (`'1'` for two gardeners), `mazewright-mode` (the way of play) and
`mazewright-shed` (seeds, `owned` towers, `masters` bought and extra `slots`) and
`mazewright-replays` (per garden, the latest Classic or Swarm win as a `Replay`; progress files
carry it, progress codes leave it out as too big for a QR code).

Test hooks (read by `e2e/playthrough.spec.ts` through `window.game.scene.getScene('Game')`):
`screen`, `state` (the `Game`), `replay` (the `Replay` watched, or null), `pouch`, `buttons` (every button by id, centred, in view pixels:
`map-<garden>` (the cards of the season shown, `season-<season>`), `watch-<garden>`, `duo`, `pouch-<tower>`, `tool-<tower>`, `tool2-<tower>` (two gardeners), `tool-upgrade`, `tool-sell`, `tool2-upgrade`, `tool2-sell`, `wave`, `speed`, `gardens`, `upgrade`, `sell`,
`turn`, `aim`, `again`) and `grid` (the grid's corner and cell size in view pixels).

Difficulty: `startLives` (25, 15, 10) and `hpScale` (0.8, 1, 1.25) use `byDifficulty`. Reduced
motion holds the frost pulse and cannon boom rings at full size and the gold numbers still.

## Sound

`SONG` (104 BPM, G major): `calm` (the picker and between waves), `battle` (a wave in play, E minor),
`boss` (while a queen or a king is out or to come) and the stings `win` and `lose`.

| Sound | Where |
| --- | --- |
| `plant`, `build` | a hedge or another tower built (`built` event) |
| `upgrade`, `sell` | `upgraded`, `sold` |
| `honey`, `snare` | a honey pot springs, a snare catches a foe (a burst plays `cannon`) |
| `bow`, `cannon`, `storm`, `crossbow`, `bonfire`, `puffball`, `sunglass`, `whirligig`, `swallow`, `nettle`, `toadstool` | a tower fires (`shot`), one per shot, rate-limited |
| `apples` | an apple tree drops its gold (`apples`) |
| `frost` | a frost pulse |
| `pop` | a foe beaten |
| `leak` | a foe takes cabbages from the patch |
| `lost` | cabbages carried into a burrow |
| `saved` | loose cabbages roll back into the patch |
| `horn`, `cleared` | a wave starts, a wave is held |
| `chew` | a mole starts chewing, and the hedge is gone |
| `wilt`, `freeze` | summer wilts a tower, winter frost freezes one (`wilt`, `frozen`) |
| shared `refuse` | a refused placement, a disabled button, Start wave while a wave is still coming out |
| shared `click` | every button |

## Common changes

- **A tower's numbers**: `TOWER` in `rules.ts`. A new tower kind also needs its drawing in
  `art.tower`, its `${kind}Name`/`${kind}Text` texts, a sound named after it in `SFX` if it fires,
  and its firing in `sim.fire`. It gets a pouch chip on its own, in the two rows of
  `CHIPS.perRow`.
- **A foe**: add it to `FOES` and `FOE`, its look in `art.foe` (beetle-shaped foes in `beetle`), its colour in `FOE_COLOUR`, its
  `new_${kind}` text, and put it in `WAVES`.
- **A garden**: add a `MapDef` to `MAPS` with its season (three a season fill `CARDS.xs`; keep the
  burrows and the cottage free of rocks and water, the burrows able to reach the cottage, and a path
  garden's banks on its lawn), and its `${id}Name`/`${id}Text` texts (two lines on the card).
- **The playthrough** plays the first wave on the Meadow with the default pouch: hedges in column 4 rows 0 to 9 (a drag),
  a refused tap on (4, 10), bows at (3, 9), (5, 9) and (5, 7), then wave 1 (six beetles). A change to
  `START_GOLD`, the hedge or bow cost or numbers, the beetle or wave 1, `waveReward`, the Meadow's
  rocks, `GRID` or `CELL` goes with its update in `e2e/playthrough.spec.ts`.
