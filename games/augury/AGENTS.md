# Augury: guide for agents

How Augury is built and where things stand, for agents changing it. README.md covers how to play,
the puzzles, the modes and the relics. Keep this file up to date with any change to the game, per
the root AGENTS.md.

## Current state

Augury is a collection of nine brain puzzles in an Arcane Tarot look (night-sky purple, thin gold
frames, cyan for what is picked or done), played through six modes. Every puzzle is made in code
from a seed at one of four levels (0 Novice to 3 Oracle), and is solved when its rules hold, not
only by the answer it was made from.

Implemented today:

- Puzzles (`KINDS`): Picture Grid (`nonogram`), Bridges, Code Breaker (`code`), Calc Cages
  (`calc`), Cross Sums (`sums`), Unjam, Tile Flip (`flip`), Path Link (`link`) and Memory Echo
  (`echo`), each in its own file under `game/puzzles/` with its maker, rules, moves and hint, and a
  view under `scenes/views/`.
- Modes (`MODES`): Endless Medley (`endless`), Daily Five (`daily`), Blitz, Draft Run (`draft`),
  Pass and Play (`duel`) and Practice, all in `game/run.ts`.
- Screens (`screen`): `menu` (six mode cards, Records, and Continue when a run was saved), `practice` (level buttons and nine
  puzzle cards), `records` and `run`. A run's `phase` is `playing`, `between` (the result banner),
  `draft`, `relic`, `handover` (pass and play) or `over`.
- Both ways round: a wide view gets the `WIDE` layout (the stage with a side panel at its right)
  and an upright one the `TALL` layout (the top bar in two rows, the stage, the tools, then the
  side panel's cards with the score box beside them), and turning the phone mid-run lays
  everything out again. The puzzle views take their board's area from the layout and fit it either
  way.
- Records (`Progress`): solves and losses per kind, the fastest hint-free solve per kind and level,
  the best score of Endless, Blitz and the daily five, the most solves in a draft run and the last
  daily played.

Missing or rough:

- A reload during a puzzle deals that puzzle again from its start, with its full time (the run is
  saved between puzzles, not move by move).
- Puzzle levels are by size and settings, not by the solving steps a puzzle needs; Picture Grid,
  Calc Cages and Cross Sums may have more than one answer (any that keeps the rules counts).
- Unjam makes its layouts by scattering blocks and searching (up to about half a second at
  Oracle); `TRIES`, `MAX_STATES` and `TARGET_MOVES` in `puzzles/unjam.ts` trade speed for depth.
- No translations of the glyph names (there are none on screen); the How to play names the modes.
- `docs/screenshots/menu.webp`, `puzzles.webp`, `draft.webp`, `upright.webp` (a 390x844 phone at
  2x) and `cover.png` are not made by the
  test; refresh them by hand (a Playwright script that taps the menu, Practice with hints, and a
  draft) when the look changes.

## Architecture

File map (`src/`):

- `main.ts`: creates the `Phaser.Game` (960x540 from `VIEW`, `Phaser.Scale.FIT`) with `GameScene`,
  calls `setupGame(game, { howToPlay })` and then `setupScaling(game, { fill: true, bothWays: true })`, and in dev
  builds puts `game` on `window`.
- `howToPlay.ts`: the How to play text in English (also US English) and German.
- `i18n.ts` and `i18n/`: the game's texts. `en.ts` is the British English source, `de.ts` the German
  (with `keepEnglish` for the title, Blitz and Adept) and `en-US.ts` empty. Text keys built from ids
  (`${kind}Name`, `${kind}Rule`, `${mode}Name`, `${mode}Text`, `${relic}Name`, `${relic}Text`,
  `level0`..`level3`, `res_${reason}`) must exist for every id.
- `audio.ts`: `SONG` (parts `menu`, `calm`, `blitz`, sting `over`) and the `SFX` table.
- `game/rng.ts`: `seeded` (mulberry32), `newSeed`, `dailySeed`, `between`, `pick`, `shuffle`,
  `neighbours`.
- `game/kinds.ts`: `LEVELS`/`Level`, `PuzzleDef` (`make`, `solved`, `failed?`, `hint`, `canHint?`
  (Code Breaker: false once every place is shown), `afterUndo?` (Bridges lets go of a picked
  island), `tick?`, `undo`, `limit`), `KINDS`/`KindId`, `SKILLS`/`Skill`, `SKILL_OF` and `DEFS`.
- `game/puzzles/*.ts`: one per kind, no Phaser. Each exports its `PuzzleDef`, its state type and
  its move functions (`nonoTap`, `bridgesTap`, `codeAdd`/`codeBack`/`codeGuess`, `calcSelect`/
  `calcEnter`, `sumsSelect`/`sumsEnter`, `unjamMove`, `flipTap`, `linkStart`/`linkMove`/`linkEnd`,
  `echoAnswer`), each returning whether it made a move worth keeping for Undo.
- `game/run.ts`: the tuning (`QUEUE`, `BETWEEN_MS`, `START_HINTS`, `startHearts`, `MAX_HEARTS`,
  `blitzSeconds`, `BLITZ_SOLVE_S`, `BLITZ_PENALTY_S`, `DAILY_LEVELS`, `DUEL_LEVELS`, `DUEL_FAIL_S`,
  `DUEL_HINT_S`, `RELIC_EVERY`, `RELIC_OFFER`, `DRAFT_MAX`, `HOURGLASS`, `CHARM_POINTS`,
  `CHARM_ECHO_SLOW`, `OMEN_POINTS`, `PERIL_HEARTS`, the points constants),
  `Card`, `Current`, `Result`, `Run`, `RunEvent`, and the actions (`startRun`, `act`, `drag`,
  `undo`, `hint`, `skip`, `quit`, `next`, `draftPick`, `takeRelic`, `startSecondPlayer`, `tick`,
  `canUndo`, `canHint`, `dailyDone`, `endlessLevel`, `holdsCharm`, `offerRelics`, and `makeCurrent`,
  which makes a card's puzzle fresh with its time and its charm's help, for `deal` and `loadRun`).
  A charm gives its kind's puzzles one free hint (`freeHints`; `freeUsed` counts them, and they
  cost no points) and `CHARM_POINTS` times the points, and slows Memory Echo's cards
  (`CHARM_ECHO_SLOW`) instead of the hint. A relic offer (`offerRelics`) has one charm not yet held,
  while any is left, and general relics for the rest. Omens (`omenFor`, from the card's seed so
  the deck deals as before; `canTakeOmen`, `takeOmen`): an Endless or Draft puzzle can take its
  omen until its first move or hint (`touched`, set by `act` and `hint`); Haste halves its
  `timeTotalMs`, Silence turns off `canUndo` and `canHint`, Peril makes `end` take
  `PERIL_HEARTS`, and a solve pays `OMEN_POINTS` times. The `Result` keeps the `omen`. Only this file changes a `Run`; `act` and
  `drag` (a step of a drag, with no Undo step) are the only ways a move reaches a puzzle's state.
  `skip` in Practice deals a new puzzle of the same kind and level, with nothing recorded. `quit`
  (the Leave button) ends a run that is not over through `finish`, so its bests, the daily five's
  score and the run count; Practice records nothing. `end` also writes the daily five's score so
  far and raises its best, and `startRun` counts the daily five's run, so a reload keeps them. A draft
  deals at most `DRAFT_MAX` (3) cards, the deal layout's slots, so Crystal Ball is offered once;
  Blitz's queue is levelled again after every puzzle, so "Up next" shows the level that will be
  dealt, and Blitz ends where its clock runs out, without a result for the puzzle it cut off.
- `game/catalog.ts`: `OMENS`/`OmenId`, `MODES`/`Mode`, `GENERAL_RELICS`, `CHARMS` (each kind's relic, its charm) with
  `CharmId`, `CHARM_KIND` and `isCharm`, `RELICS`/`RelicId` (both kinds), `KIND_COLOR`,
  `RELIC_COLOR` (a charm takes its kind's colour).
- `game/progress.ts`: `Progress`, `newProgress`, `recordResult`. `game/save.ts`: `loadProgress`,
  `saveProgress`, and `saveRun`, `loadRun` (checks the saved run and deals its puzzle in play again
  from its card) and `clearRun`.
- `scenes/GameScene.ts`: every screen, input and event.
- `scenes/painter.ts`: `Painter`, an immediate-mode drawer: per layer a Graphics and a text pool,
  plus `hits` (tappable spots); `frame` (a tarot frame), `button`, `text`, `hit`, `layer`.
- `scenes/views/`: one `PuzzleView` per kind (`draw`, and `down`/`move`/`up` for the dragged ones),
  `types.ts` (`ViewCtx`, `fitGrid`), `pad.ts` (the number pad) and `index.ts` (`VIEWS`).
- `scenes/glyphs.ts`: `drawGlyph` (the six glyphs Code Breaker and Memory Echo use), `drawKindIcon`,
  `drawRelic` (a charm is its kind's icon in a ringed medallion), `trace`.
- `scenes/theme.ts`: `FONT`, `C` (colours), `PALETTE`. `scenes/layout.ts`: the `Layout` type and its two values, `WIDE` (960x540) and
  `TALL` (540x960), with every spot in the frame (`top`, `leave`, `stage`, `board`, `tools`,
  `side`, `omen` (the omen's button in the top bar), `menu` (with `resume` and `recordsAside` for when a run was saved), `practice`, `records`, `back`, `deal`, `end`, `endButtons`); `layoutFor(w, h)`,
  `VIEW` (= `WIDE.view`, for `main.ts`) and `UI_DEPTH`.

Shared code it imports: `shared/setupGame.ts`, `shared/scaling.ts` (`setupScaling`, `viewSize`,
`viewFrame`), `shared/audio.ts`, `shared/settings.ts` (`byDifficulty`, `settings`) and
`shared/i18n.ts`.

How it runs:

- Coordinates: everything is laid out in a designed frame, 960x540 sideways or 540x960 upright
  (`this.L`, from `layoutFor`). The game fills the screen's shape (`fill: true`) and turns with it
  (`bothWays: true`); `fitView` reads `viewSize`/`viewFrame`, picks the layout and scrolls the
  camera to `(-fx, -fy)` so the frame sits in the middle. It runs in `create` and on the scale
  manager's `resize`, which also redraws the backdrop; the backdrop and dims cover the whole view
  from `(-fx, -fy)`. Never use fixed coordinates in the scene: take them from `this.L`. Pointers
  are read through `pointer.worldX/Y`.
- Drawing: nothing is kept between frames. When `dirty` is set (any input, event, or a change of
  the shown clocks, tracked by `clockKey`), `draw` clears the `Painter` and draws the screen again,
  including the puzzle's `view.draw`. Cards over the board (banner, draft, relics, hand-over, end)
  go in layer 1, above the board's texts.
- Input: `onDown` finds the topmost `hit` with an `onTap` (a disabled button plays `ui('refuse')`);
  if none takes it and a puzzle is in play, the view's `down` gets it and later `move`/`up` (Unjam
  and Path Link drag). Spots without `onTap` (Unjam's blocks and cells, Path Link's cells) only
  tell the test where things are. Keys: H hint, U or Ctrl+Z undo, 1-9/Backspace for the pads,
  1-6/Backspace/Enter for Code Breaker, S/D or arrows for Memory Echo.
- Moves: a view calls `ctx.act(change)`, which runs `act(run, change)`: the puzzle's state is
  copied for Undo (for kinds with `undo`), changed, and checked for solved or failed. Picking a cell
  or island changes the state without a move (no Undo step) and plays `tap`; a bridge plays only
  `place`. A Path Link drag is one move: its first change (the start, if it cut or restarted a path,
  else the first cell crossed) goes through `ctx.act` quietly with the state from before the drag
  (`act`'s `before`), so a tap that changes nothing makes no Undo step; later cells go through
  `ctx.drag` (no Undo step, no sound), and `ctx.place` plays `place` once when it ends, if it
  changed a path.
- Time: `update` takes `dt` from the frame time (capped at `MAX_STEP_MS`) and calls `tick`, which
  runs the puzzle's clock (`timeLeftMs`), Blitz's clock (`clockMs`), Memory Echo's own clock and the
  banner between puzzles (`betweenMs`; Practice waits for a tap).
- Events: `RunEvent`s (`start`, `end`, `heart`, `hint`, `warn`, `relic`, `omen`, `over`) are drained in
  `drain` for sound and saving.
- Randomness: every card carries a seed, and its puzzle is made with `seeded(card.seed)`. Card seeds,
  kinds, draft offers and relic offers come from `Math.random`, except the daily five, whose kinds,
  levels and seeds come from `seeded(dailySeed(date))`. The backdrop uses Phaser's
  `RandomDataGenerator` with a fixed seed.

State model (`Run`): `mode`, `phase`, `hearts`, `maxHearts`, `hints`, `score`, `streak`, `dealt`,
`solved`, `current` (`card`, `state`, `timeLeftMs`, `timeTotalMs`, `elapsedMs`, `hintsUsed`, `freeHints`,
`freeUsed`, `omen`, `touched`, `history`), `queue`, `results`, `last`, `betweenMs`, `clockMs`, `relics`, `relicOffer`,
`draftOffer`, `player`, `totals`, `duelSolved`, `day`, `progress`, `newBest` and `events`.

Persistence: two `localStorage` keys. `augury-run` holds the run in play (every mode but Practice,
without `progress` and `events`): `keepRun` saves it each time it moves on (a puzzle dealt or
ended, a draft or relic offer, the hand-over), and clears it when the run is over or left. On load
`loadRun` hands it to `saved`, and the menu's Continue (`resume`) picks it up; starting another run
first ends the saved one through `quit`, so its bests and its run count. `augury-progress` holds
`Progress`. It is written when a run
starts (the daily five counts as played, and as a run, from its first card), after every puzzle
(with the daily five's score so far and its best), when a run ends and when leaving to the menu, which ends the run and records
it (`quit`). `loadProgress` keeps only known kinds and whole, non-negative numbers.

### Hub settings

- Difficulty scales two numbers: hearts in Endless and Draft, `startHearts` =
  `byDifficulty(4, 3, 2)`, and Blitz's clock, `blitzSeconds` = `byDifficulty(240, 180, 150)`. Keep
  Normal at 3 hearts (the playthrough expects it) and the README's and the root README's rows in
  sync.
- `settings.reduceMotion` drops the glow on the menu title. Nothing shakes, flashes or blinks.

## Sound

All sound is made in code by `shared/audio.ts`; `src/audio.ts` holds the song and effects, and only
`GameScene` plays them. Nothing plays under browser automation.

Music, `SONG` (76 BPM, D minor, a triangle lead): `menu` on the menu, practice and records screens,
`calm` during a run of every mode but Blitz, `blitz` during Blitz; sting `over` when a run ends.
`update` calls `playMusic` every frame with the part for the screen (not on the end card, so the
sting plays out).

| Sound | Where |
| --- | --- |
| `tap` | a cell, island or block picked (`ctx.tap`), and Undo |
| `place` | a move made (`ctx.act`), or a Path Link drag that changed a path, once when it ends (`ctx.place`) |
| `deal` | a `start` event |
| `solved` / `lost` | an `end` event, solved / lost, skipped or out of time |
| `heart` | a `heart` event |
| `hint` | a `hint` event |
| `warn` | a `warn` event (each of a clock's last five seconds) |
| `turn` | a Memory Echo card turned (`update`) |
| `relic` | a `relic` event |
| `omen` | an `omen` event (an omen taken) |

Shared sounds: `ui('click')` on mode cards, menu buttons and picks, `ui('refuse')` for a disabled
button (Undo with nothing to undo, Hint with none left or none that can help, a pad key before a
cell is picked, the daily five played today), and a Hint tap that finds nothing to show.

## Testing hooks

- `src/main.ts` exposes `window.game` in dev builds. The test reads `game.scene.getScene('Game')`
  and its `run` (copied through JSON, without `events` and `progress`), `screen` and `buttons`
  (every spot on screen by id, centred, in view pixels: `mode-<mode>`, `records`, `back`,
  `resume`, `omen`, `level-<n>`, `kind-<kind>`, `undo`, `hint`, `skip`, `leave`, `cell-<i>`, `key-<n>` (0 is Clear),
  `island-<i>`, `glyph-<i>`, `code-back`, `code-guess`, `block-<k>`, `echo-same`, `echo-diff`,
  `draft-<i>`, `relic-<i>`, `next`, `done`, `again`, `start2`, `dim`).
- Inputs: it taps `mode-endless`, then solves whatever the seeded deck deals with real taps and
  drags, reading each puzzle's answer from its state (`picture`, `needed`, `answer`, `code`,
  `solution`, `open`, `blocks`, `seq`/`step`/`back`/`answers`), and taps `skip`.
- Mirrored in `e2e/playthrough.spec.ts`, so change them together: the `Run` field names, `VIEW`,
  3 hearts on Normal, `QUEUE`, `BETWEEN_MS`, `POINTS_PER_LEVEL`, the first puzzle at level 0 with a
  clock, never the same kind twice in a row, Unjam's 6x6 board, every puzzle state's answer fields
  and every spot id above, the scene key `'Game'` and the save key `augury-progress`.
- It saves `playthrough-0-menu`, `-1-first-puzzle`, `-2-solved` and `-3-third-puzzle`.

## Making common changes

- **Add a puzzle kind**: a file in `game/puzzles/` exporting its `PuzzleDef` and moves, its id in
  `KINDS`, `SKILL_OF`, `DEFS` and `KIND_COLOR`, a view in `scenes/views/` added to `VIEWS`, an icon
  case in `drawKindIcon`, its `Name` and `Rule` texts in English and German, a README row, and a
  case in the test's `solve` (the deck may deal it). Nine kinds fill the practice screen's 3x3
  grid sideways and two columns upright; a tenth needs `practice.cards` laid out again in both
  layouts.
- **Add a mode**: its id in `MODES` (six fill the menu's row of cards, two rows of three
  upright; a seventh needs `menu.cards` laid out again in both layouts), its `START_HINTS`, its rules in `startRun`, `end`, `next` and
  `finish`, its side panel in `drawSide`, its top line in `topLine`, its icon in `modeIcon`, its
  `Name` and `Text` texts, and the README.
- **Add a relic**: its id in `GENERAL_RELICS` and `RELIC_COLOR`, its effect in `takeRelic`,
  `timeFor`, `makeCurrent` or `offerDraft`, an emblem in `drawRelic`, its texts and the README row. A relic that does nothing
  twice is left out of the offer in `next` once held, like Crystal Ball.
- **Retune**: the constants at the top of `run.ts` and of each puzzle file (sizes and counts per
  level, `limit` seconds per level); mirror the Normal hearts and the first-round numbers in the
  test.
- **Move something on screen**: change it in both `WIDE` and `TALL`, and check an upright phone
  (390x844) and German there, where the mode cards, the side panel's cards and the score box are
  narrowest. A puzzle view lays out in its `ctx.r` (580x330 sideways, 488x430 upright), so check
  both shapes when a view changes.
- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it); run `node scripts/check-translations.mjs` and check German with `?lang=de` (mode
  cards and the code legend are the tightest spots).

## Gotchas

- A view draws from `ctx.s` and registers its hits during `draw`; a move between draws changes the
  same state object, and the scene redraws after every input, so hits never go stale.
- `act` copies the whole puzzle state (`JSON.stringify`) before each move for Undo; keep puzzle
  states plain data (no `Set`, `Map` or class instances).
- Unjam's drag and pick (`drag`, `picked`) live in its view module; `resetUnjam` clears them when a
  puzzle is dealt.
- Path Link's drag flags (`moved`, `start`) live in its view module; `down` clears them, since a
  drag that solves the puzzle never reaches `up`.
- The practice run has `hints: Infinity`, which JSON turns into `null` for the test.
- Never use a red cross in any art (root AGENTS.md); the Calc Cages icon's plus is violet.
