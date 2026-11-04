# Augury

A collection of brain puzzles built with [Phaser 4](https://phaser.io), TypeScript and Vite, part of
the [game hub](../../README.md).

Thirteen kinds of puzzle, dealt like cards from an arcane tarot deck: logic, numbers, spatial thinking
and memory. Every puzzle is made in code from a seed, so they never run out, and each kind comes at
four levels, from Novice to Oracle. Walk a journey of forty set puzzles through five temples, play an endless medley of random puzzles, the same five puzzles
as everyone else today, a race against the clock, a draft run where you pick the next card and
gather relics, the same draft run as everyone else this week in the weekly league, a pass-and-play match for two, or practise any puzzle with no clock.

![Endless Medley: a Path Link puzzle with the next three cards up next](cover.png)

It plays sideways or upright, and turns with the phone.

![Endless Medley on an upright phone](docs/screenshots/upright.webp)

## How to play

| Control | Action |
| --- | --- |
| Tap or click | Fill a cell, pick an island, flip, slide or turn a tile, place a mirror, press a pad key, a glyph or a number |
| Drag | Slide a block (Unjam) or draw a path (Path Link) |
| Keys 1-9, Backspace | Write or clear a number (Calc Cages, Cross Sums); pick a glyph (Code Breaker) |
| Enter | Make the guess (Code Breaker) |
| S and D, or Left and Right | Same or different (Memory Echo) |
| Undo (U), Hint (H), Skip | Take back a move, use a hint, give the puzzle up |
| Leave | Back to the menu (the run ends there, and its score and bests count) |
| Continue | On the menu after a reload: picks the run up again (every mode but Practice) |

### The puzzles

| Puzzle | Skill | Rules |
| --- | --- | --- |
| Picture Grid | Logic | Fill cells so each row and column shows its runs of filled cells, in order. A second tap marks a cell empty. |
| Bridges | Logic | Tap two islands in a line to lay a bridge (a second makes it double, a third takes it away). Each island needs as many bridges as its number, bridges never cross, and every island must connect. |
| Code Breaker | Memory | Find the hidden row of four glyphs. Each guess shows filled pegs for right glyphs in the right place and rings for right glyphs in the wrong place. Run out of guesses and it is lost. |
| Calc Cages | Numbers | Every row and column holds each number once, and the numbers in each cage make its target with its sign. |
| Cross Sums | Numbers | A number crossword: each run of cells adds up to its clue, with no number twice in a run. |
| Unjam | Spatial | Slide blocks along their length (drag them, or tap one and then a free cell in its line) to free the gold block through the gap. |
| Tile Flip | Spatial | A tap flips a tile and its four neighbours; put every light out. |
| Path Link | Spatial | Drag to join each pair of matching stars; the paths fill every cell and never cross. |
| Star Slide | Spatial | Tap a tile beside the gap to slide it in. Put the tiles in order, 1 first and the gap last (3x3 up to Adept, 4x4 from Master). |
| Star Series | Numbers | Three rows of numbers, each following a rule (steps, two steps in turn, growing steps, doubling or tripling, and at Oracle the sum of the two before, squares, or double and add). Pick the number that comes next from four; a third wrong pick loses the puzzle, and a hint strikes out a wrong option. |
| Pipe Turn | Spatial | Every tile is a piece of pipe; a tap turns it a quarter round. Turn the tiles until the water from the well reaches every house (4x4 at Novice up to 7x7 at Oracle). A hint turns one tile right. |
| Mirror Maze | Logic | A beam shines in from the lamp at one edge. Tap empty cells to place a mirror (/, then \\, then none) so the beam passes through every crystal, with only as many mirrors as the puzzle gives (2 at Novice up to 5 at Oracle). A hint takes away a wrong mirror or places a right one. |
| Memory Echo | Memory | Cards turn up one at a time; say whether each is the same as the one 1, 2 or 3 steps back. Three in four must be right. |

Any answer that keeps the rules counts, not only the one the puzzle was made from.

![Nine of the puzzles](docs/screenshots/puzzles.webp)

![Star Slide](docs/screenshots/star-slide.webp)

![Star Series](docs/screenshots/star-series.webp)

![Pipe Turn](docs/screenshots/pipe-turn.webp)

![Mirror Maze](docs/screenshots/mirror-maze.webp)

### Modes

![The menu: eight mode cards](docs/screenshots/menu.webp)

- **Journey**: forty set puzzles, the same for everyone, in five temples of eight steps. Each
  temple teaches two or three kinds and ends in a boss. A step solved with half its time left earns
  three stars, with a quarter two, else one, and every paid hint costs a star. Each step opens the
  next, and 12 of a temple's 24 stars open the next temple. One hint per step.

  ![The journey's map of five temples](docs/screenshots/journey.webp)

- **Endless Medley**: random puzzles one after another, never the same kind twice in a row, three
  more always showing as Up next. Every three puzzles the level goes up. Each puzzle has its own
  clock; a lost, skipped or timed-out puzzle costs one of 3 hearts. 2 hints for the whole run. It
  deals the kinds you have the least mastery of more often (see Mastery).
- **Daily Five**: five puzzles of five kinds, the same for everyone on the same day, from Novice to
  Oracle. One try a day; the menu shows today's score. The ghost of your best daily five races you
  in the side panel: a faint bar shows the score your best run had at this point of its run, under
  your own.

  ![The daily five with the ghost of the best run](docs/screenshots/daily-ghost.webp)

- **Blitz**: three minutes on one clock and no hearts. A solve gives back 10 to 25 seconds (more at
  higher levels), a skip or a loss takes 10. The level rises every two solves.
- **Draft Run**: before each puzzle, choose one of the cards dealt. Every third solve offers three
  relics: one charm (while any is left) and two of the others, each of which can be taken again
  except the Crystal Ball (a draft deals three cards at most):

| Relic | Effect |
| --- | --- |
| Lantern | One more hint. |
| Heartstone | One more heart, up to 5. |
| Hourglass | A quarter more time on every puzzle. |
| Crystal Ball | One more card to choose from in every draft. |

  Each puzzle kind has its own charm, taken once: Inkwell (Picture Grid), Bridgewright (Bridges),
  Cipher Wheel (Code Breaker), Abacus (Calc Cages), Tally Stone (Cross Sums), Oiled Gear (Unjam),
  Mirror Coin (Tile Flip), Silver Spool (Path Link), Brass Compass (Star Slide), Brass Spigot (Pipe
  Turn), Prism (Mirror Maze), Sextant (Star Series) and Echo Shell (Memory Echo). Its kind's
  puzzles come with a free hint, which costs no points, and pay half again the points; Memory Echo,
  which has no hints, turns its cards a third slower instead. A draft card marks the charm it
  is helped by, so the run leans towards the kinds you hold charms for.

  ![A relic offer with a charm](docs/screenshots/charms.webp)

- **Weekly League**: a Draft Run dealt from the week's seed, so every player gets the same cards
  and relic offers all week (Monday to Sunday). Play it as often as you like; the menu keeps the
  week's best and its rank: Novice, Adept (1,000 points), Mystic (3,000), Oracle (6,000) and Seer
  (10,000).

  ![The weekly league's end card with its rank](docs/screenshots/weekly-rank.webp)

- **Pass and Play**: two players take turns on the same three puzzles (Novice, Adept, Master). The
  lower total time wins; a skip or loss adds 30 seconds and a hint 15.
- **Practice**: pick any puzzle and level. No clock, no hearts, free hints, and a new puzzle of the
  same kind whenever you like. Or pick **Trial** for each kind's hardest open trial (see Mastery).

**Mastery**: every solve of a kind, in any mode, raises its mastery, from 1 to 10 (2, 5, 9, 14, 20,
28, 38, 50 and 65 solves). Practice and Records show each kind's level as a badge. Each level opens
the next of ten trials of that kind in Practice, on the clock: trial I is a Novice puzzle on its
usual time, trial IV a Master one, trial VI an Oracle one, and trials VII to X Oracle puzzles on
85% down to half their time. A trial solved in time without a hint is cleared. Endless deals the
kinds with the lowest mastery more often (one share more per level below your best kind).

![Practice trials with each kind's mastery](docs/screenshots/mastery.webp)

![A draft: two cards to choose from](docs/screenshots/draft.webp)

**Bosses**: every fifth puzzle of Endless and Draft (and the weekly league) is a boss, framed in rose: two puzzles of two
kinds played back to back on one clock (four fifths of their two times added up). Beat both for
double points and a relic pick, in Endless too (there without the Crystal Ball); a loss, skip or
timeout in either half loses the boss. Up next and the draft cards say which puzzle follows.

![A boss: its second half, Picture Grid after Tile Flip](docs/screenshots/boss.webp)

**Omens**: in Endless and the drafts, each puzzle offers an omen in the top bar until its first move or
hint. Tempt it for double points: **Haste** halves the puzzle's time, **Silence** takes away Undo
and hints, and **Peril** makes a loss cost two hearts (Memory Echo only offers Peril).

![An omen on offer: Tempt Haste](docs/screenshots/omen.webp)

**Trophies**: ten to earn, from the first solve to a boss beaten under an omen, listed behind the
Trophies button on the start and pause screens.

![The Trophies list](docs/screenshots/trophies.webp)

**Points**: 100 per level (Novice 100 to Oracle 400), plus 2 for every second left, less 40 per
hint (never below 20), times a streak bonus of 10% per puzzle solved in a row (up to double).
**Records** keeps the puzzles solved of each kind, its mastery, the fastest solve without hints at
each level, and the best score of each mode.

**Difficulty** (hub setting): Easy gives 4 hearts in Endless and the drafts and 4 minutes of Blitz, Hard
2 hearts and 2½ minutes; Normal is 3 hearts and 3 minutes. The puzzles themselves don't change.

## Code layout

- `src/game/puzzles/`: the thirteen puzzles, each making itself from a seed and level, with its
  rules, moves and hint (`nonogram`, `bridges`, `code`, `calc`, `sums`, `unjam`, `flip`, `link`,
  `slide`, `pipe`, `beam`, `series`, `echo`).
- `src/game/kinds.ts`: the puzzle kinds, their skills and the `PuzzleDef` they share.
- `src/game/journey.ts`, `src/game/weekly.ts`: the journey's steps and stars, the weekly league's
  week and ranks.
- `src/game/run.ts`: the eight modes: dealing, hearts, hints, clocks, points, drafts and relics.
- `src/game/progress.ts`, `src/game/save.ts`: the records, mastery, trials and the daily ghost, and
  their save.
- `src/scenes/GameScene.ts`: the menu, journey map, practice picker, records and the run screen.
- `src/scenes/views/`: how each puzzle is drawn and played.
- `src/scenes/painter.ts`, `glyphs.ts`, `theme.ts`, `layout.ts`: drawing, emblems, colours and
  positions.
- `src/audio.ts`: music and sound effects.
