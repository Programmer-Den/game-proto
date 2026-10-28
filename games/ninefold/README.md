# Ninefold

A number-placement puzzle built with [Phaser 4](https://phaser.io), TypeScript and Vite, part of the
[game hub](../../README.md).

Fill the board so every row, column and box holds each digit once. Play the daily puzzle (the same
board for everyone that day), Classic boards at three levels, or **Delve**: a run of ever bigger
boards where every mistake costs a heart and each cleared floor offers a relic. Every puzzle is
made in code with exactly one solution, so they never run out. Solving boards unlocks nine art
styles, from Paper Cut-out to Stained Glass; the digits stay plain and easy to read in all of them.

![A Classic board in Paper Cut-out](cover.png)

## How to play

| Control | Action |
| --- | --- |
| Tap or click a cell, or the arrow keys | Pick a cell |
| Number pad, or keys 1-9 | Write that digit in the picked cell |
| Notes (N) | Switch to pencil marks: digits then toggle small notes in the cell |
| Erase (Backspace) | Clear a wrong digit from the picked cell, or an empty cell's notes |
| Undo (U or Z) | Take back the latest note, wrong digit or erase (a mistake still counts) |
| Hint (H) | Fill in the picked cell, or the first open one |
| Menu | Leave the board for the menu |

It plays sideways or upright, whichever way the phone or window is held, and turns with it: upright,
the board sits under a header with the mode, hearts and clock, and the nine digits make one row of
keys under the board.

<img src="docs/screenshots/upright-board.webp" alt="A Classic board on an upright phone" width="270">

A right digit stays. A wrong one shows in red, counts a mistake and can be erased or written over.
Picking a cell lights its row, column and box, and every cell holding the same digit; the number
pad shows how many of each digit are still to place and greys out finished ones. A finished row,
column or box flashes and stays tinted.

A board in play is saved as you go (a Delve run with its relics, or its relic offer between
floors, too), so closing the page and coming back goes on where you stood.

![The tools row with Undo](docs/screenshots/undo.webp)

### Modes

- **Daily puzzle**: a Normal 9x9 board picked by the date. The menu ticks it off once solved, until
  the next day, and counts your **daily streak**: daily puzzles solved on days in a row.

![The menu with a daily streak](docs/screenshots/streak-menu.webp)
- **Classic**: a fresh 9x9 board at Easy (40 givens), Normal (32) or Hard (26), with 3 hints and no
  limit on mistakes. **Next puzzle** deals another at the same level.
- **Delve**: floor 1 is a 4x4 board, floors 2 and 3 are 6x6 and from floor 4 every floor is a 9x9
  with fewer givens (past floor 6, one fewer every 3 floors, down to 24). The run starts with 3
  hearts and 1 hint; a mistake costs a heart, and at none the run ends. From floor 4 each floor
  draws a twist, and every 5th floor is a **boss floor** with two twists (one on the board, one
  that presses you) and 3 fewer givens; clearing a boss floor restores every heart. The cleared
  floor's card names the next floor and its twists:

| Twist | Rule |
| --- | --- |
| Diagonal | Both long diagonals hold each digit once too (2 fewer givens). |
| Parity | Marked cells hold even digits, the rest odd (6 fewer givens). |
| Clock | A heart is lost every 3 minutes on the floor; the clock counts down to it. |
| Sealed | No hints on the floor; clearing it gives one back. |

![A boss floor: Diagonal and Clock](docs/screenshots/boss-floor.webp)

![A Parity floor](docs/screenshots/parity-floor.webp)

A cleared floor also offers three of ten relics. The last six give something and take something; Twin Sight is held once, every other relic can be taken again:

| Relic | Effect |
| --- | --- |
| Lantern | One more hint. |
| Heartstone | One more heart, up to 5. |
| Seer's Eye | Every floor starts with 2 more cells filled in. |
| Ward | The first mistake on each floor costs no heart. |
| Twin Sight | Every floor starts with each empty cell's candidates noted. One heart less. |
| Gambler's Die | 8 right digits in a row give a hint; a mistake that costs a heart costs one more. |
| Phoenix Feather | When the last heart goes, it burns and the run goes on with one heart. |
| Sandglass | A floor cleared within 4 minutes heals a heart. |
| Iron Vow | Two more hearts, up to 5, but every hint is gone. |
| Keystone | The first box finished on each floor heals a heart. |

![Relic cards with trade-offs](docs/screenshots/new-relics.webp)

![More relic cards with trade-offs](docs/screenshots/new-relics-2.webp)

![Floor 1 cleared: three relics on offer](docs/screenshots/delve-relics.webp)

![A cleared floor's card naming the boss floor ahead](docs/screenshots/next-floor.webp)

![The menu](docs/screenshots/menu.webp)

### Styles

**Styles** on the menu shows all nine; tap an unlocked one to wear it. Every solved board, in any
mode, counts towards them:

| Style | Unlocks when you |
| --- | --- |
| Paper Cut-out | start (the default) |
| Garden Markers | solve 3 puzzles |
| Chalkboard | solve a puzzle with no mistakes |
| Ink & Parchment | solve 10 puzzles |
| Cosy Pixel | solve a puzzle without hints |
| Star Chart | solve a Hard puzzle or Delve floor 6 |
| Carved Stone | solve 25 puzzles |
| Neon Arcade | solve a 9x9 in under 10 minutes |
| Stained Glass | have unlocked every other style |

![The style picker](docs/screenshots/style-picker.webp)

![The same board in all nine styles](docs/screenshots/all-styles.webp)

### Trophies

Nine trophies (`src/trophies/`), listed under **Trophies** on the start and pause screens; the
last two stay hidden until earned:

| Trophy | Tier | Earned by |
| --- | --- | --- |
| First fill | Bronze | Solving your first puzzle, in any mode |
| Clean slate | Bronze | Solving a puzzle with no mistakes |
| Quick pencil | Bronze | Solving a 9x9 in under 10 minutes |
| Three in a row | Silver | Solving the daily puzzle three days running |
| Boss breaker | Silver | Clearing a Delve boss floor |
| Deep digger | Silver | Clearing Delve floor 10 |
| Full palette | Gold | Unlocking all nine styles |
| A week of puzzles | Gold | Solving the daily puzzle seven days running |
| Bottom of the well | Gold | Clearing Delve floor 20 |

![A trophy earned on a boss floor](docs/screenshots/trophy-toast.webp)

**Difficulty** (hub setting): Easy gives 5 hints a Classic board and 4 hearts a Delve run, Hard 2
hints and 2 hearts; Normal is 3 and 3. The puzzles themselves don't change.

## Code layout

- `src/game/sudoku.ts`: making and solving 4x4, 6x6 and 9x9 boards with one solution.
- `src/game/state.ts`: the rules of both modes, hints, relics and style unlocks.
- `src/game/catalog.ts`: the styles, relics and Classic levels.
- `src/game/save.ts`: the saved progress.
- `src/scenes/GameScene.ts`: the menu, style picker, board, panel and end cards.
- `src/scenes/layout.ts`: where everything sits, sideways and upright.
- `src/scenes/themes.ts`: the colours and fonts of the nine styles.
- `src/audio.ts`: music and sound effects.

See [AGENTS.md](AGENTS.md) for the architecture and how to change things.

## Run it

From the repository root: `npm run dev`, then open `/games/ninefold/`. The playthrough test is
`npx playwright test --project ninefold`.
