# Ninefold: guide for agents

How Ninefold is built and where things stand, for agents changing it. README.md covers how to play,
the relics and the styles. Keep this file up to date with any change to the game, per the root
AGENTS.md.

## Current state

Ninefold is a number-placement puzzle (every row, column and box holds each digit once) with two
modes, a technique school and ten unlockable art styles. Classic plays a 9x9 board at Easy, Normal,
Hard, Killer, Thermo, Arrow, Kropki or Sandwich, plus a daily puzzle seeded by the date (each one
solved stamps the calendar) and the weekly gauntlet (a seeded board a day, scored over the week);
Delve is a run of floors (4x4, then 6x6, then 9x9 with fewer givens) with hearts, hints and relics
between floors, at up to five ascensions. Every solved board counts towards the first nine style
unlocks, and a full calendar month earns the tenth (Almanac); the worn style redraws everything
(backdrop, board, panel, buttons, cards).

Implemented today:

- One scene (`GameScene`) with five screens (`screen`: `menu`, `styles`, `school`, `calendar`,
  `board`) and cards over the board for the phases `lesson` (a lesson's opening card), `solved`
  (Classic, daily, weekly, and a learned lesson's stamp), `relic` (a cleared Delve floor) and `over`
  (a Delve run out of hearts).
- Puzzles are made in code (`makePuzzle`): a random full board, then cells emptied while the
  solution stays unique, down to the givens asked for (a board that can't lose more keeps a few
  more). 9x9 boards take a few to a few tens of milliseconds. An `Extra` rule adds `Puzzle.even`
  (Parity), `Puzzle.cages` (Killer: `makeCages` cuts the solved board into cages of 1 to 4 cells,
  no digit twice, each with its `sum`) or `Puzzle.thermos` (Thermo: `makeThermos` walks up to six
  lines of 3 to 6 cells, bulb first, each step to a cell beside or diagonal to the last with a higher
  digit, no diagonal step crossing another). The solver checks them per candidate (`checker`,
  `allowed`: a cage's open cells must still be able to make up its sum, a thermometer cell must
  leave room below and above and rise past every filled cell on its line), so the solution is
  unique with the extra rule. Killer boards with 10 givens take about 10 ms. Three more rules:
  `Puzzle.arrows` (Arrow: `makeArrows` draws up to eight circles, each with an arrow of 2 to 4 cells
  stepping beside or diagonal, whose digits add up to the circle's; `allowed` keeps an arrow's sum
  within reach of its circle, or of the board's size while the circle is open), `Puzzle.dots` (Kropki: `makeDots` puts a dot between every two
  side-by-side cells one apart (white) or one double the other (black; 1-2 gets black), and two
  cells without a dot are neither, checked by `dotFits`) and `Puzzle.sandwich` (Sandwich:
  `makeSandwich` sums each row's and column's digits between its 1 and its highest digit;
  `sandwichFits` checks a line once both ends stand). A board with an extra rule gives each
  uniqueness check `CHECK_STEPS` search steps; a check that runs out keeps its cell, so a hard
  board keeps a few more givens instead of taking seconds (Sandwich boards prune least: 20 givens
  take about 50 ms, 12 about 600 ms). Plain boards have no budget, so daily boards are as before.
- Hints (`hint`) fill the picked cell, or with none picked the cell `explain` (`techniques.ts`)
  finds easiest, else the first open one, and set `hintNote` to the technique that places it
  (`revealed` when none of `TECHNIQUES` does; `explain` only knows rows, columns, boxes and
  diagonals, so boards with an extra rule often end there) and `hintAt`; the panel's relics row names
  it for `HINT_NOTE_MS`. `explain` looks for a hidden single, then a naked single, and when there is
  neither applies one elimination (naked pair, pointing pair, X-wing) to the candidates and looks
  again. For a picked cell (`only`) it places the singles it finds elsewhere on the way, as a
  player would, until one lands on that cell. Each deduction records what it removed and what it
  relied on, and the step keeps in `used` only those its single needed (walking back, so an
  elimination that set up a needed one counts too); the step's `technique` is the hardest of them
  and the single.
- The technique school (`lessons.ts`): `LESSONS` are four 6x6 boards (hidden single, naked pair,
  pointing pair, X-wing) stopped where that technique is the way on, found once by `explain` from
  seeded boards and kept as digit strings, with the `marks` that show the technique and the `target`
  cell it unlocks. `startLesson` deals one (`mode` `lesson`, `lesson` its index, every empty cell's
  candidates noted, one hint) under its opening card (`phase` `lesson`); `beginLesson` starts play.
  `afterFill` ends it once `target` is right: `learned` adds the technique to `Progress.lessons`
  and shows the stamp card (`phase` `solved`, a `learned` event). Lessons count nothing else and are
  never saved as the board in play.
- The calendar: `solved` adds each daily's `dailyDate` to `Progress.dailyDays` (sorted, once);
  `stampedDays` reads a month's, `daysIn` its length and `fullMonths` how many months are full,
  which unlocks `MONTH_STYLE` (Almanac). The scene's `calMonth` is the month shown (year * 12 +
  month), between the first month stamped and this one. A daily's solved card says how far its month
  has come.
- Entering: a right digit is filled in for good and clears that digit from its peers' notes; a
  wrong one stays (shown in `wrong`/`wrongBg`), counts a mistake, and in Delve costs a heart unless
  a Ward catches the floor's first. Erase clears a wrong digit, or an empty cell's notes. Notes mode
  toggles a bit per digit in `notes`. Hints: see above.
- Finished rows, columns and boxes (`doneUnits`) flash once and stay tinted; picking a cell tints
  its peers and every cell with the same right digit.
- The daily streak: `solved` counts `Progress.dailyStreak` up when the daily solved is the day after
  the last one (`nextDay` in `sudoku.ts`), else starts it at 1, and keeps `bestStreak`; the menu's
  stats line shows `dailyStreakNow` (0 once a day is missed).
- Delve floors are planned by `planFloor` (a `FloorPlan`: floor, size, givens, twists, boss) from
  `FLOORS`; past its last row a floor loses a given every `DEEPER_EVERY` floors, down to
  `MIN_GIVENS`. From `TWIST_FLOOR` (4) each floor draws a twist (`TWISTS` in `catalog.ts`, each
  taking `TWIST_GIVENS` off): `diagonal` (`Shape.diagonal`: both long diagonals are units too, so
  `units`, `peersOf` and the solver all know them), `parity` (`Puzzle.even` marks the even cells;
  `makePuzzle(..., parity)` keeps the solution unique with the marking, which the solver honours),
  `killer`, `thermo`, `arrow`, `kropki` and `sandwich` (the Classic levels' rules; `extraOf` picks a
  floor's `Extra` from `EXTRAS`), `clock` (`tick` takes a heart every `CLOCK_MS` of floor time, a `clock` event; `clockLeft` counts
  down in the panel) and `sealed` (`hint` refuses; clearing the floor gives a hint back). Every
  `BOSS_EVERY` (5th) floor is a boss floor: one board twist (`BOARD_TWISTS`) and one pressing twist (`PRESSING_TWISTS`), `BOSS_GIVENS`
  fewer givens, and clearing it restores every heart and counts `Progress.bosses`. Floors before
  `TWIST_FLOOR` draw no randomness, so the first floors deal as before. `solved` plans the next
  floor into `upcoming`, which the cleared-floor card names (`nextLine`) and `nextFloor` deals;
  `plan` is the floor in play. `hasTwist` tells whether a twist is on. Relics (`RELICS`): Lantern
  (+1 hint), Heartstone (+1 heart, up to `MAX_HEARTS`), Seer's Eye (`SEER_CELLS` more cells filled
  at the start of each floor, per copy), Ward (first mistake each floor is free), and six with a
  trade-off: Twin Sight (`nextFloor` notes every empty cell's candidates; one less max heart; in
  `UNIQUE_RELICS`, so it leaves the offers once held), Gambler's Die (`streak` of right digits pays
  a hint every `GAMBLER_STREAK`, a `gift` event; a mistake that costs a heart costs one more),
  Phoenix Feather (`loseHearts` burns one at no hearts for a `phoenix` event and one heart),
  Sandglass (a floor cleared within `SANDGLASS_MS` heals a heart), Iron Vow (`VOW_HEARTS` more
  hearts, every hint gone) and Keystone (`keyHealed`: the first finished box a floor heals a heart).
  Every heart lost goes through `loseHearts` and every heart healed through `heal` (a `heal` event).
- Ascensions: `startDelve(s, ascent)` starts a run at an ascension no higher than
  `ascensionOpen(progress)` (`min(MAX_ASCENT, Progress.climbed)`), kept in `GameState.ascent`.
  Clearing floor `ASCEND_FLOOR` (10) at an ascension `>= climbed` sets `climbed` to one more, and if
  that is still an ascension (`<= MAX_ASCENT`) sets `ascended` and pushes an `ascended` event (the
  cleared-floor card says it opened; the menu moves its pick there). The rules, cumulative, start
  at `ASCENT` (`hearts` 1: one heart fewer; `hint` 2: no starting hint; `givens` 3: `ASCENT_GIVENS`
  fewer givens in `planFloor`; `notes` 4: `notesLocked`, so `toggleNotes` refuses and Twin Sight
  leaves the pool; `offer` 5: one relic fewer offered, the two cards sit between the three spots).
  `ASCENSION_RULES` in `catalog.ts` names each rule's text for the menu. The scene's `pickAscent`
  is the ascension the menu's Delve button starts at (the `ascent-down`/`ascent-up` arrows, shown
  once one is open); the run-over card's Delve again starts at the ended run's `ascent`.
- The weekly gauntlet (`mode: 'weekly'`): `GAUNTLET` lists the seven boards (givens and a board
  twist), Monday first; `startWeekly` deals today's from `seeded(weekSeed * 10 + weekDay)` once a
  day (it sets `Progress.weekScores[day]` to 0, so the try is used, and returns false when it
  already was), resetting `weekScores` when `Progress.week` is an older week. `solved` scores it
  with `gauntletScore` (`GAUNTLET_SCORE`), records it under the board's own `week`, and keeps
  `bestWeek`; `score` and `weekTotal` feed the solved card. `weekScores(p, date)` reads the week as
  it stands. Hints are `classicHints`, mistakes unlimited.
- Both ways round: a wide view gets the `WIDE` layout (board left, panel with a 3x3 pad right) and an
  upright one the `TALL` layout (header panel, board, then a dock with one row of nine keys and the
  tools), and turning the phone mid-game lays everything out again.
- Styles (`STYLES`, `THEMES`): Paper Cut-out (default), Garden Markers, Chalkboard, Ink &
  Parchment, Cosy Pixel, Star Chart, Carved Stone, Neon Arcade, Stained Glass and Almanac (a wall
  calendar), unlocked by `UNLOCKS` and picked on the style screen. `PALETTE_STYLES` are the nine
  before Almanac: Stained Glass and the Full palette trophy wait only for those. Fonts are the
  device's own, so nothing is downloaded.

Missing or rough:

- The weekly gauntlet has no shared leaderboard either; a gauntlet board left by Menu scores 0 for
  its day, and a missed day of the week can't be played late.
- The daily puzzle has no shared leaderboard; once solved, the menu ticks it off and disables its
  button for today.
- Undo takes back notes, wrong digits and erases only; a right digit can't be taken back (it is
  right), and an undone mistake still counts.
- Leaving a board by Menu drops it (the save is cleared); only a closed or reloaded page comes back
  to it.
- Puzzle levels are by given count, not by the solving techniques they need; `explain` could grade
  them, but it doesn't yet, and it knows no extra rule.
- The calendar can't fill a missed day late, so a full month needs every day's daily on its day.
- Only four lessons, all 6x6; the hint can name a naked single, which has no lesson.
- `docs/screenshots/all-styles.webp`, `style-picker.webp`, `menu.webp`, `upright-board.webp` (a
  390x844 phone at 2x) and `cover.png` are not made by
  the test; refresh them by hand (a Playwright script that sets `ninefold-progress` with every style
  unlocked and taps like the test) when the look changes. `delve-relics.webp` is the test's
  `playthrough-3-relics` screenshot.

## Architecture

File map (`src/`):

- `main.ts`: creates the `Phaser.Game` (960x540 from `VIEW`, `Phaser.Scale.FIT`) with `GameScene`,
  calls `setupGame(game, { howToPlay, trophies })` and then `setupScaling(game, { fill: true, bothWays: true })`, and in dev
  builds puts `game` on `window`.
- `howToPlay.ts`: the How to play text in English (also used for US English, which spells nothing
  differently there) and German; update both when the controls or the first round change.
- `i18n.ts` and `i18n/`: the game's texts (`shared/i18n.ts`). `en.ts` is the British English source,
  `de.ts` the German (with `keepEnglish` for the title) and `en-US.ts` only "Cozy Pixel". Every text
  on screen goes through `t`; game logic compares ids.
- `audio.ts`: `SONG` (parts `menu`, `calm`, `delve`, stings `solved` and `over`) and the `SFX` table.
- `game/sudoku.ts`: `Shape`, `SHAPES`, `Puzzle`, `Cage`, `Arrow`, `Dot`, `Rules`, `EXTRAS`/`Extra`, `makeCages`, `makeThermos`, `makeArrows`, `makeDots`, `makeSandwich`, `dotFits`, `seeded` (mulberry32), `dailySeed`, `boxOf`,
  `units`, `peersOf`, `countSolutions` and `makePuzzle` (the solver picks the cell with the fewest
  candidates). No Phaser.
- `game/techniques.ts`: `TECHNIQUES`/`Technique`, `Step`, `candidates` and `explain`. No Phaser.
- `game/lessons.ts`: `Lesson`, `LESSONS` and `lessonPuzzle`.
- `game/state.ts`: the tuning (`CLASSIC_GIVENS`, `HINT_NOTE_MS`, `DAILY_LEVEL`, `classicHints`, `delveHearts`,
  `DELVE_HINTS`, `MAX_HEARTS`, `RELIC_OFFER`, `SEER_CELLS`, `FAST_MS`, `HARD_FLOOR`, `FLOORS`,
  `DEEPER_EVERY`, `MIN_GIVENS`, `TWIST_FLOOR`, `BOSS_EVERY`, `BOSS_GIVENS`, `TWIST_GIVENS`, `CLOCK_MS`,
  `LEVEL_EXTRA`, `ASCEND_FLOOR`, `ASCENT_GIVENS`, `ASCENT`, `GAUNTLET`, `GAUNTLET_SCORE`),
  `FloorPlan` and `planFloor`, `Progress`, `UNLOCKS`, `GameEvent`, `GameState` and the actions (`newGame`, `startClassic`,
  `startDaily`, `startWeekly`, `startDelve`, `startLesson`, `beginLesson`, `lessonOf`, `daysIn`, `fullMonths`, `stampedDays`, `notesLocked`, `ascensionOpen`, `weekDay`, `weekSeed`, `weekScores`, `gauntletScore`, `select`, `toggleNotes`, `canEnter`, `enter`, `erase`, `hint`, `hasTwist`, `clockLeft`,
  `takeRelic`, `chooseStyle`, `toMenu`, `tick`, `unlock`, `isRight`, `digitsLeft`). Only this file
  changes `GameState`.
- `game/catalog.ts`: `STYLES`/`StyleId`/`STYLE_INFO`, `MONTH_STYLE`, `PALETTE_STYLES`, `RELICS`/`RelicId`/`RELIC_INFO`, `TWISTS`/`Twist`/`TWIST_INFO`
  with `BOARD_TWISTS` and `PRESSING_TWISTS`, `ASCENSION_RULES`/`MAX_ASCENT` and `LEVELS` (`easy`,
  `normal`, `hard`, `killer`, `thermo`, `arrow`, `kropki`, `sandwich`).
- `game/save.ts`: `loadProgress` and `saveProgress`, and `saveBoard` and `loadBoard` for the board in play.
- `scenes/GameScene.ts`: everything drawn and all input.
- `scenes/themes.ts`: `Theme`, `THEMES` (one per style) and `hex`.
- `scenes/layout.ts`: the `Layout` type and its two values, `WIDE` (960x540) and `TALL` (540x960),
  with every spot (`board`, `panel` and its `rows`, `dock`, `pad` with its `cols`, `tools`,
  `keysHint`, `menuButton`, `menu`, `school`, `calendar`, `stylesTitle`, `styleCards`, `back`, `end`, `endButtons`,
  `relicBox`, `relicCards`; the menu's `daily` and `weekly` side by side, eight `levels` (one row
  wide, two rows of four upright), the `ascentDown`/`ascentUp` arrows beside `delve`, and `school`,
  `styles` and `calendar` in its bottom row); `layoutFor(w, h)`, `VIEW` (= `WIDE.view`, for `main.ts`) and `UI_DEPTH`.

Shared code it imports: `shared/setupGame.ts`, `shared/scaling.ts` (`setupScaling`, `viewSize`,
`viewFrame`), `shared/audio.ts` (`sounds`, `playMusic`, `playSting`, `ui`), `shared/settings.ts`
(`byDifficulty`, `settings`) and `shared/i18n.ts` (`translator`, `byLanguage`, `Translation`).

How it runs:

- Coordinates: everything is laid out in a designed frame, 960x540 sideways or 540x960 upright
  (`this.L`, from `layoutFor`). The game fills the screen's shape (`fill: true`) and turns with it
  (`bothWays: true`: `shared/scaling.ts` turns the view round on an upright window, and again when
  the window turns). `fitView` reads `viewSize`/`viewFrame`, picks the layout and scrolls the camera
  to `(-fx, -fy)`, so the frame sits in the middle of the view; it runs in `create` and on the scale
  manager's `resize`, which also redraws the backdrop and rebuilds the screen. Backdrops
  (`drawDeco`, placed against the view's edges) and dims are drawn from `(-fx, -fy)` over the whole
  view. Never use fixed coordinates in the scene: take them from `this.L`. Taps on the board use
  `pointer.worldX/Y`.
- Time: `update` takes `dt` from the frame time (capped at `MAX_STEP_MS`) and calls `tick`, which
  only runs the board's clock (`timeMs`) while playing. Nothing else is timed; the flashes age by
  `dt`.
- Events: the rules push `GameEvent`s (`board`, `placed`, `wrong`, `clock`, `phoenix`, `heal`, `gift`, `hint`, `unit`, `solved`, `ascended`,
  `unlocked`, `relic`, `over`, `learned`) onto `state.events`; `drain` plays their sounds, adds flashes, saves
  the progress and switches the screen to `board` when a board loads. It also picks the music part.
- Redrawing: `currentKey` names what is on screen (screen, phase, style, board size, relic offer,
  mode, floor, the menu's ascension pick, and today's date on the menu); when it changes `buildLayer` destroys `parts` and rebuilds the screen or card. The board
  (`boardG`, the 81 digit and note texts) is redrawn when `dirty` is set by an input or event; the
  panel's clock, hearts, hints and notes label are set every frame in `updatePanel`.
- Input: the scene's `pointerdown` picks a cell (only on the board while playing). Buttons are a
  `Graphics` and a text under an interactive `Zone` (`button`), which stops the event so it never
  reaches the board; disabled ones play `ui('refuse')`. Keys: 1-9, arrows, N, H, U or Z (undo), Backspace/Delete/0.
- End cards sit above a dim zone that swallows taps (`dim`, `raise`).
- The board's square is `B`: the layout's `board`, less a margin along its top and left on a
  Sandwich board, where `clueTexts` (18) hold the sums. Arrows are a ring on the circle and a line
  with a head through the arrow's cells; Kropki dots sit on the line between two cells, white or
  black; a lesson tints its `marks` and rings its `target`, all under the digits.
- Board rules on screen: `drawCage` draws a Killer cage's dashed edge inside each cell (running on
  across the grid line where the cage goes on), and the cage's sum sits in its first cell's corner
  (`sumTexts`, one per cage; that cell's notes move down). Thermometers are an opaque tube, mixed
  from the cell and note colours, with a round bulb on the first cell, under the digits. The
  panel's kicker names the mode, the ascension (`ascentTag`) and the twists, and shrinks to stay
  clear of the Menu button.

State model (`GameState`): `phase` (`menu`, `lesson`, `playing`, `solved`, `relic`, `over`), `mode`
(`classic`, `daily`, `weekly`, `delve`, `lesson`), `level`, `puzzle` (`size`, `boxW`, `boxH`, `diagonal`, `solution`, `givens`, and `even`, `cages`, `thermos`, `arrows`, `dots` or `sandwich`), `week` and `weekDay` (the gauntlet board in play), `score` and `weekTotal` (its result), `ascent` and `ascended`,
`values` (0 empty; may hold a wrong digit), `notes` (bit per digit), `selected` (-1 none),
`notesMode`, `mistakes`, `hintsLeft`, `hintsUsed`, `timeMs`, `hearts`, `maxHearts`, `floor`,
`plan` and `upcoming` (Delve `FloorPlan`s, null otherwise), `dailyDate` (the `dailySeed` a daily board was dealt for, 0 otherwise), `relics`, `relicOffer`, `warded`, `streak`, `keyHealed`, `lesson`, `hintNote`, `hintAt`, `undo` (the cells' digits and notes before each note, wrong digit or erase; `undoMove` restores the newest whose cell isn't right, `canUndo`), `doneUnits` (indexes into `units`), `newStyles`, `progress` and
`events`.

Persistence: two `localStorage` keys of its own (and `ninefold-trophies`, kept by `shared/trophies.ts`). `ninefold-board` holds the board in play (`saveBoard`/`loadBoard`
in `save.ts`: the `BOARD_FIELDS` of `GameState` plus `LATER_FIELDS` (`week`, `weekDay`, `ascent`, `ascended`, which a save from before them may lack and then load as their defaults), written by `update` whenever the scene is dirty and
every `SAVE_EVERY_MS` of board time, and removed once the phase is neither `playing` nor `relic`, or the board is a lesson);
`create` restores it, straight onto the board or the relic offer. `ninefold-progress` holds `Progress` (`solved`, `flawless`,
`noHint`, `hard`, `fast`, `bestFloor`, `bosses`, `daily`, `dailyStreak`, `bestStreak`, `climbed`, `week`, `weekScores` (seven numbers, -1 not played), `bestWeek`, `dailyDays`, `lessons`, `style`, `unlocked`; a save from before `dailyDays` gets its `daily` stamped, and one
from before ascensions with `bestFloor` at `ASCEND_FLOOR` or deeper gets `climbed` 1). It is written when a board is
solved or a gauntlet board starts (that uses up the day's try), a style unlocks, a lesson is learned or an ascension opens, a Delve run ends or a style is picked. `loadProgress` keeps only known
styles and re-checks `UNLOCKS`.

Randomness and timing: `makePuzzle` and the relic offer use `Math.random`, except the daily puzzle,
which uses `seeded(dailySeed(date))`, and the gauntlet, which uses `seeded(weekSeed * 10 + day)`.
A puzzle with no extra rule draws the same numbers as before, so daily boards didn't change. The backdrops use Phaser's `RandomDataGenerator` with a fixed
seed. All rule timing is game time from `tick`.

### Hub settings

- Difficulty scales two numbers: Classic hints `classicHints` = `byDifficulty(5, 3, 2)` and Delve
  hearts `delveHearts` = `byDifficulty(4, 3, 2)`. Keep Normal at 3 and 3 (the playthrough expects
  3 hearts and 1 Delve hint), and keep the README's row and the root README's difficulty table in
  sync.
- `settings.reduceMotion` skips the finished-unit and solved flashes (`drawFlashes`). Nothing
  shakes or blinks.

## Trophies

`src/trophies/index.ts` lists ten (`trophySet('ninefold', ...)`, handed to `setupGame` in
`main.ts`), with their texts in `src/trophies/i18n/` (`en.ts`, `de.ts`). `src/trophies/check.ts`
awards each from `Progress` alone (`EARNED`): `firstSolve` (solved 1), `flawless`, `fast`, `streak3`
and `streak7` (`bestStreak`), `firstBoss` (`bosses`), `floor10` and `floor20` (`bestFloor`),
`allStyles` (every one of `PALETTE_STYLES` unlocked) and `ascent5` (`climbed >= 6`: floor 10 cleared at Ascension 5);
`streak7`, `floor20` and `ascent5` are hidden. `GameScene` calls
`checkTrophies` once in `create` (quietly, for a saved progress) and in `drain` after any event.
They are saved under `ninefold-trophies`. The playthrough checks that floor 1, solved with a
mistake, earns only First fill. A new trophy needs its id in `index.ts`, its two texts in each
`i18n` file, its condition in `EARNED`, and a README row.

## Sound

All sound is made in code by `shared/audio.ts`; `src/audio.ts` holds the song and effects, and
only `GameScene` plays them. Nothing plays under browser automation.

Music, `SONG` (84 BPM, a triangle music-box lead): `menu` on every screen but the board (menu, styles, school, calendar), `calm` on
Classic and daily boards (G major), `delve` on Delve floors (A minor, busier drums); stings `solved`
(every solved board) and `over` (a Delve run ends). `drain` calls `playMusic` every frame with the
part for the screen; the engine only switches when it changes.

| Sound | Where |
| --- | --- |
| `tap` | a cell picked (`onBoardTap`) |
| `place` | a `placed` event |
| `wrong` / `heart` / `ward` | a `wrong` event in Classic / one that cost a heart (or a `clock` event) / one the Ward caught |
| `note` | a digit entered in notes mode |
| `erase` | Erase on a cell with a wrong digit or notes to clear |
| `hint` | a `hint` event |
| `unit` | a `unit` event (a row, column or box finished) |
| `unlock` | an `unlocked` or `ascended` event, picking a style, and a `learned` event (with the `solved` sting) |
| `relic` | a `relic` event, and a `phoenix` event |
| `unlock` (heal) / `hint` (gift) | a `heal` event / a `gift` event |

Shared sounds: `ui('click')` on menu and card buttons and the Notes toggle, `ui('refuse')` for a
digit, Erase or Hint that can't be used, a disabled pad key and a locked style.

## Testing hooks

- `src/main.ts` exposes `window.game` in dev builds. The test reads `game.scene.getScene('Game')`
  and its `state` (copied through JSON, without `events`), `screen`, `cellSpots` (`{ cell, x, y,
  w, h }` per cell of the board, in view pixels) and `buttons` (spots by id: `daily`, `easy`,
  `normal`, `hard`, `killer`, `thermo`, `arrow`, `kropki`, `sandwich`, `weekly`, `delve`, `ascent-down`, `ascent-up` (once an ascension is open), `styles`, `school`, `calendar`, `menu`, `key-1`..`key-9`, `notes`, `erase`, `undo`, `hint`,
  `relic-0`..`relic-2`, `next`, `done`, `again`, `back`, `style-<id>`, `lesson-0`..`lesson-3`, `start`, `month-prev`, `month-next`).
- Inputs: it taps `delve`, taps cells from `cellSpots` and pad keys from `buttons`, toggles
  `notes`, taps `erase` and `relic-0`. It never uses hints and stays on Delve floors 1 and 2.
- The playthrough also reads `ninefold-trophies` (only `firstSolve` after floor 1).
- Mirrored in `e2e/playthrough.spec.ts`, so change them together: the `GameState` field names,
  `VIEW`, 3 hearts and `DELVE_HINTS` (1) on Normal, `FLOORS[0]` and `FLOORS[1]` (sizes and givens),
  `RELIC_OFFER`, `MAX_HEARTS`, `SEER_CELLS`, each relic's effect, Cosy Pixel unlocking on a first
  solve without hints (and nothing else on a first solve with a mistake), the scene key `'Game'`
  and the save key `ninefold-progress`.
- It saves `playthrough-0-menu`, `-1-floor-1`, `-2-mistake`, `-3-relics` and `-4-floor-2`.

## Making common changes

- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and a US entry in `i18n/en-US.ts` if the spelling differs; run
  `node scripts/check-translations.mjs` and check German with `?lang=de` (style card names and the
  pad tools are the tightest spots).
- **Add a style**: its id in `STYLES` (the order is the unlock order; Stained Glass waits for the
  `PALETTE_STYLES` before it), `STYLE_INFO` and its two texts, its goal in `UNLOCKS`, its `THEMES`
  entry, a case in `drawDeco`, and the README row. `WIDE` lays the cards four across in three rows
  (twelve) and `TALL` two across in five (ten), so an eleventh style needs a sixth `TALL` row.
- **Add a lesson**: find a board with a script that runs `explain` over seeded `makePuzzle` boards
  until a step needs the technique alone (`used` is just it), add it to `LESSONS` with its texts
  (`<id>Name`, `<id>Blurb`, `<id>Lesson`, `<id>Task`), and a technique `explain` doesn't know goes
  into `TECHNIQUES` (by difficulty) with its elimination. More than four needs more `school.cards`.
- **Add a board rule** (like Killer or Thermo): its data on `Puzzle` and `Rules`, a maker run from
  `makePuzzle` for a new `Extra` in `EXTRAS` (and its data in `hasRules`), its check in `allowed` (keep it cheap: it runs per candidate), its
  drawing in `drawBoard`, then a Classic level (`LEVELS`, `CLASSIC_GIVENS`, `LEVEL_EXTRA` and a
  `levels` spot in both layouts; the rows are full at eight) and/or a twist. Time `makePuzzle` at
  the givens you pick: a rule that prunes little leans on `CHECK_STEPS`.
- **Add an ascension**: its rule's text in `ASCENSION_RULES`, its start in `ASCENT`, its effect where
  the run applies it, and the README's table.
- **Add a twist**: its id in `TWISTS` with `TWIST_INFO` and its two texts, its `TWIST_GIVENS`, its
  rule where it applies (`sudoku.ts` for a board rule, `tick`, `hint` or `solved` otherwise), how
  the board or panel shows it in `GameScene`, and the README's twist table. A boss floor draws its
  two twists from the two lists in `planFloor`.
- **Add a relic**: its id and `RELIC_INFO` in `catalog.ts` (and `UNIQUE_RELICS` if it is held once), its effect in `takeRelic`, `nextFloor`,
  `enter`, `afterFill`, `solved` or `loseHearts`, an emblem in `drawRelicIcon`, a README row and a case in the test's `switch`. More
  relics still offer three.
- **Retune**: the constants at the top of `state.ts`; mirror the first two `FLOORS` and the Normal
  hearts in the test.
- **Board sizes**: `SHAPES` in `sudoku.ts`; the pad has nine keys, so boards go up to 9x9.
- **Move something on screen**: change it in both `WIDE` and `TALL`, and check an upright phone
  (390x844) and German there, where the style cards and relic cards are narrowest.

## Gotchas

- A right digit is never wrong again, so `canEnter` refuses a cell that is right; Erase only clears
  a wrong digit, or the notes of an empty cell, and reports false when there is nothing to clear.
- A unit the Seer's Eye completes at the start of a floor is recorded in `doneUnits` by `markDone`
  without a `unit` event, like the givens' units; only `afterFill` (a digit or hint) celebrates one.
- `drawBoard` only restyles a digit or note text whose style key (font, size, colour, glow or wrap
  width) changed, since `setStyle` re-renders the text's canvas.
- A solved daily is recorded under the date it was dealt for (`dailyDate`), not the date it was
  solved, so finishing it after midnight doesn't tick off the next day's. `currentKey` includes
  today's date on the menu, so a menu left open past midnight rebuilds its daily button.
- Keys with Ctrl, Cmd or Alt held are left to the browser.
- `drawBoard` hides every digit text first; a board of fewer than 81 cells uses the first
  `size * size` texts.
- Buttons stop their `pointerdown` so the board never sees a tap on the panel; anything tappable
  that doesn't go through `button` must do the same.
- Never use a red cross in any art (root AGENTS.md).
