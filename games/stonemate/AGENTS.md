# Stonemate: guide for agents

Chess with living statues, where every capture plays a scene of its own. Read this before changing
the game, and keep it up to date in the same PR as the change (see the root `AGENTS.md`).

## Current state

- **Modes:** Play White or Play Black against the Stone AI, Two players on one screen (the board
  stays with White at the bottom), Rival sculptors, Statue puzzles (and the Daily puzzle), and the
  Capture gallery, which plays any of the 30 capture pairs on a three-square stage. **Continue
  game** comes back to a saved game (against the AI, two players or a rival). The menu has two
  columns of buttons and, under them, the **Back row** and **Clock** options (saved as `shuffled`
  and `clock` in `stonemate-prefs`), which apply to games against the AI and two-player games.
- **Shuffled back row** (`shuffledRank` in `game/rules.ts`): the knights, bishops and queen are
  shuffled over the b, c, d, f and g files (bishops on opposite colours, never the usual row), the
  same for both sides through `startWith(rank)`; the king and rooks stay home so castling is
  unchanged. A game keeps its start as FEN (`Position.start`, saved as `start`).
- **Clocks** (`CLOCKS` in `game/rules.ts`: 5+3, 10+5, 15+10, as minutes and seconds added per
  move): `GameScene.update` runs the clock of the side to move, except while a move animates
  (`moving`) or the scene is paused; the AI's thinking counts. A move adds the increment.
  `outOfTime` ends the game as `{ kind: 'time', winner }` (a draw, `timeout`, when the winner has
  only its king), counted like a mate except for `quickMate`. The clocks are saved with the game.
- **Rival sculptors** (`game/rivals.ts`): eight opponents in `RIVALS`, each an AI level with a
  `style` whose `styleBias` (points added to a move at the root of the search: `chooseMove`'s and
  `chooseMoveDeep`'s `bias`, sent to the worker as the style id) leans it among close moves, and
  `odds` (missing knights) for the first three, built by `rivalStart`. The player is White against
  even indices, Black against odd ones. `stonemate-rivals` keeps how many are beaten; the next one
  is open, the rest locked. A win against the next rival opens the one after; it counts in the stats
  and `firstWin` but never opens AI levels. A beaten rival plays `playRivalDefeat`: its `emblem`
  statue rises over the board with its last line and breaks as `breaks` (`playDefeat` in
  `captures.ts`).
- **Statue puzzles** (`game/puzzles.ts`): 72 positions (`PUZZLES`, 24 each of mate in one, two and
  three, as FEN plus the line of solution and defence) found by a mate search over Stone AI games
  (a throwaway script); every solving move but the last is the only one that mates in time. The
  `LADDER` is 15 of them, opened in order and kept in `stonemate-puzzles`. A puzzle plays as mode
  `puzzle` with the player on the side to move: a move that isn't the line's (or, last, any mate)
  is a miss, shown and taken back; the AI answers with the line's defence. **Hint** marks the next
  statue to move and counts as a miss. Puzzles count no stats, pairs or trophies.
- **Daily puzzle** (`shared/daily.ts`, game `stonemate`): `dailyPuzzle(dailyRand('stonemate'))`
  picks one of the 72; starting it uses up today's try (`startDaily`), solving it scores
  `max(1, 3 - misses)` (`finishDaily`). The menu's Daily puzzle button starts it, or opens the
  puzzle screen once today's try is used.
- **Game review** (`showReview`): the result box's Review button steps through the game just
  played. `runReview` asks the worker (`analyse` in `think.ts`, `analyseDeep` in `deep.ts`, depth 8
  in 30,000 nodes, no shuffling) for every position's best move and score, in turn; a move is
  marked `best` (the search's own pick), `good`, `doubtful` (a loss of `DOUBTFUL` = 60 or more) or
  `blunder` (`BLUNDER` = 200 or more), the loss being `score[i] + score[i + 1]`. Only the player's
  moves are marked against the AI or a rival, both sides' in a two-player game. A doubtful move or
  a blunder draws the better move as an arrow. The review isn't saved.
- **Rules:** full chess in `game/chess.ts`: castling, en passant, promotion (a picker with queen,
  rook, bishop and knight; the AI weighs all four like any other move, so it nearly always takes a
  queen, but may pick another piece that scores as well, for instance one that is taken at once), check, checkmate, and draws by stalemate,
  too little material (kings alone, or one bishop or knight), fifty moves (100 plies without a
  capture or pawn move) and threefold repetition.
- **Stone AI levels:** seven, in `LEVELS` (`game/rules.ts`), picked on the menu with the
  `level-down` and `level-up` arrows and saved as `level` in `stonemate-prefs`. Until one is picked,
  `defaultLevel()` follows the hub's difficulty: Easy is 2, Normal 3, Hard 4. Levels 1 to 3
  (`OPEN_LEVELS`) are always open; each one above opens when the player beats the level below it
  (`unlockedLevel(stats.best)`). The arrows still step onto a locked level, which shows a lock and
  the level to beat, and Play White and Play Black refuse it (`startAi`); a pick above the open
  levels is lowered to the highest open one at boot. A win that opens a level says so in the result
  box and moves the menu's pick up to it. A game keeps the level
  it started on (`gameLevel`, saved with the game). The names are Beginner, Novice, Casual player, Club player, Expert, Master and Grandmaster. Each level beat the
  one below it in AI-against-AI matches (a throwaway script, not in the repo).
- **Levels 1 to 4** (`game/ai.ts`, `shallow` in `LEVELS`): negamax with alpha-beta, material plus
  piece-square tables, captures and promotions ordered first, a capture search to depth 4 at the
  leaves and a 60,000-node cap. Depth and slack: Beginner 1 and 250, Novice 1 and 90, Casual 2 and
  15 (the old Normal, which the playthrough plays), Club 3 and 0 (the old Hard). Among moves within
  the slack of the best it picks at random (through `Math.random`), but never gives up a mate. A
  move that repeats a position a third time scores as a draw. It runs on the page, in one frame.
- **Levels 5 to 7** (`game/deep.ts`, `deep` in `LEVELS`): iterative deepening with a transposition
  table, principal variation search, null-move pruning, late move reductions, killer and history
  ordering and a check extension, over an evaluation that adds the endgame king, passed, doubled
  and isolated pawns, the bishop pair and rooks on open files. It moves through pseudo-legal moves
  and checks each as it is made. Its budget is in nodes, never time, so it plays alike on every
  machine: Expert depth 3 in 30,000 nodes, Master depth 5 in 200,000, Grandmaster depth 12 in
  700,000 (about 3 seconds a move). It shuffles the root moves with a seed from `Math.random`, so
  equal moves vary. `thinkDeep` (`game/think.ts`) runs it in a web worker (`game/aiWorker.ts`, which
  plays the game's moves out from the start) and falls back to the page when a worker can't start.
- The AI thinks 450 ms after the board settles, then moves; `gen` drops an answer that comes back
  after the screen changed.
- **Capture scenes** (`scenes/captures.ts`): a capture plays `strike(attacker)` then `fall(victim)`,
  one strike per kind (6) and one fall per victim kind (5); the 8 pairs in `SIGNATURES`
  (`game/rules.ts`) play `signature(id)` instead. Quick captures (the panel's Captures button, saved
  under `stonemate-prefs`) skip the strike and the signature, slide the attacker and play the fall
  at double speed. The full scenes run at 1.2 times their written length (`Director.k`). Reduce
  motion drops camera shake and flashes (`Stage.still`). Checkmate plays `playMate` (the king
  cracks and falls to rubble), a promotion `playPromote` (a ring of rune light).
- **Statues** (`scenes/statues.ts`, painted by `scenes/art.ts`): sculpted figures in a 100-unit
  box: a hooded sentry with a shield (pawn), a tower with a lit gate and window slits (rook), a seer
  with a lamp staff (bishop), a horse head with a carved mane (knight), a veiled queen with a tiara
  and a bearded king in an ermine mantle, each on a studded plinth. White is marble with gold inlay
  and amber gems, Black obsidian with silver inlay and violet gems, and every statue has rune eyes.
  `paintPieces` paints them on canvases at boot; Black's statues face left (`flipX`).
  `fragment(kind, side, how)` cuts a statue into halves side by side, head and body at its `NECK`,
  or 7 shards, painted once and kept. The king's
  crown ends in a diamond gem, never a cross.
- **Trophies** (`src/trophies/`): `firstCapture` (a capture by the player), `promotion`, `joust`
  (knight takes knight), `firstWin`, `upset` (pawn takes queen), `quickMate` (mate the AI within
  `QUICK_MATE` = 25 of your moves), `allScenes` (all 8 signatures seen in games), `hardWin` (beat
  level `HARD_LEVEL` = 4, Club player, or stronger), `grandmasterWin` (beat level 7) and the hidden `allPairs` (all 30 pairs seen in games, by either side). In a two-player game both sides
  count as the player; wins only count against the AI.
- **Layout:** fills the screen (`setupScaling(game, { fill: true })`). `create` sizes the squares to
  the view's height and centres the board and the panel to its right together. The corner buttons
  sit top right (`setupGame(..., { corner: 'top-right' })`), clear of the board.

## Architecture

- `GameScene` is the only scene. `screen` is `menu`, `play`, `gallery`, `rivals`, `puzzles` or
  `review`; each screen is drawn from scratch by `showMenu`, `buildPlay`, `showGallery`,
  `showRivals`, `showPuzzles` and `drawReview`, which call `clear()`: it destroys every
  object, stops tweens and timers and bumps `gen`, so an `await` that comes back after a screen
  change sees `gen` changed and stops.
- A move: a board tap (`onBoardTap`) picks a statue or plays a legal move; `play(move)` animates it
  on the sprites (`playCapture` or `playMove`, plus the rook when castling), then `pos.make`, then
  `syncPieces()` puts fresh sprites on the board from the position. `busy` holds input while a move
  plays or the AI thinks. After a move: the result is checked, the game saved, and `maybeAi()`
  schedules the AI. A game that ends is counted (`record`: stats, trophies, the save removed) as
  soon as its last move is made, before the mate scene, so leaving for the menu during that scene
  can't skip it; the result box (`showResult`, through `finish`, which plays a beaten rival's scene
  first) follows the scene. `startGame(mode, player, moves, level, { start, rival, clock, puzzle })`
  starts every kind of game; `newGame` adds the menu's back row and clock. Once a game against the AI has
  ended, `undo` refuses (two players may still take back the last move), and
  the result box's New game plays the menu's level, or the highest open one if the arrows rest on a
  locked level. Reduce motion also holds the Upset! tremble and the rune duel's knot still.
- Buttons are `button(id, ...)`: an interactive rectangle with its text, recorded in `buttons[id]`
  (middle and size in view pixels) for the playthrough. The scene's own `pointerdown` handles the
  board only when no button was hit.
- `Position.history` holds every move with its undo data, so the captured rows, the last move's
  highlight, the save and undo all read it.

## Save keys

- `stonemate-game`: the game under way, `{ mode: 'ai' | 'duo' | 'rival', player: 'w' | 'b', level: 1-7, moves: ['e2e4', ...], start?, rival?, clock? }`
  (`start` the FEN when it isn't the usual one, `rival` 0 to 7, `clock` `{ minutes, plus, w, b }`
  with the milliseconds left); removed when a game ends. A save from before the levels has no
  `level` and plays the menu's. Puzzles are never saved.
- `stonemate-stats`: `{ wins, losses, draws, pairs: ['nb', ...], scenes: ['joust', ...], best }`,
  `best` being the strongest AI level beaten (0 for none), which opens the levels above 3.
- `stonemate-prefs`: `{ quick, level, shuffled, clock }`, the Captures button, the menu's AI level,
  back row and clock (0 for none, else a row of `CLOCKS` plus one).
- `stonemate-rivals`: `{ beaten }`, how many rival sculptors are beaten (0 to 8).
- `stonemate-puzzles`: `{ solved: [0, 1, ...] }`, the ladder puzzles solved, by puzzle number.
- `stonemate-daily`: the daily puzzle's record, kept by `shared/daily.ts`.
- `stonemate-trophies`: kept by `shared/trophies.ts`.

## Test hooks

The dev build puts `game` on `window`; the playthrough reads `game.scene.getScene('Game')`:

- `state`: `screen`, `mode`, `player`, `level` (the game's AI level), `unlocked` (the highest open level), `turn`, `plies`, `busy`, `selected`, `result`, `inCheck`,
  `captures`, `lastCapture`, `promo`, `legal` (the legal moves as `e2e4` text while a person is to
  move), `start` (FEN), `clock` (`{ w, b }` ms left, or null), `rival`, `rivalsBeaten`, `puzzle`
  (`{ id, daily, misses }` or null) and `review` (`{ ply, plies, done, marks }` or null).
- `buttons`: every button by id (`level-down`, `level-up`, `play-white`, `play-black`, `two-players`, `rivals`, `puzzles`, `daily`, `gallery`, `continue`,
  `variant`, `clock`, `undo`, `hint`, `quick`, `menu`, `new-game`, `review`, `next-puzzle`, `result-menu`, `promote-q` and the others, `pair-nb` and the
  others, `rival-0` to `rival-7`, `puzzle-0` to `puzzle-14`, `daily-play`, `review-first`, `review-prev`, `review-next`, `review-last`, `back`).
- `board`: `{ x, y, size, flip }`, the board's top-left corner and square size in view pixels and
  whether Black is at the bottom.
- `pos.board`: the 64 squares (0 is a8, 63 is h1), a piece being its kind 1 to 6 (pawn to king)
  plus 8 for Black.

The playthrough plays White against level 3 (the default on Normal), opens with `e2e4`, follows a short plan and takes the
first piece it can, then waits for the AI's reply, checks the pair is in the stats, the game is
saved and `firstCapture` is the only trophy.

## Sound

`src/audio.ts`: `SONG` is a slow D minor hall tune, `calm` on the menu and gallery, `battle` in a
game, with `win` and `lose` stings at the end (a two-player mate plays `win`). `SFX`: `step` (each
hop of a walk or glide), `stomp` (a knight landing), `slam` (a rook's ram), `chop` (a sword or a
tap), `crack`, `shatter`, `rubble`, `bolt` (a rune bolt), `beam`, `clash` (two blows meeting), `hum`
(a statue gathering light), `pick` (a statue picked up), `check` and `promote`. The capture scenes
play them through `Stage.sfx`. A tap on the board while the AI is thinking plays the shared
`refuse`; nothing plays while a saved game is replayed.

## Common changes

- **More puzzles:** add `FEN|line` rows to `DATA` in `game/puzzles.ts`, each checked by a mate
  search (the solver's moves before the last must be the only ones that mate in time, and no
  shorter mate may exist), and keep `LADDER`'s ids pointing at the ones meant for it. The daily pick
  changes for every player when the count changes.
- **A new rival or style:** a row in `RIVALS` (`game/rivals.ts`), a `case` in `styleBias` for a new
  style, and its name, style and last line in `src/i18n/` (`rival…`, `style…`, `line…`, keyed by
  the id with a capital first letter), plus the README's rival table.

- **A new signature scene:** add the pair to `SIGNATURES` in `game/rules.ts`, a `case` in
  `Director.signature` in `scenes/captures.ts`, its name in `src/i18n/` (en, de), and the
  `allScenes` count follows from `SIGNATURES`; update the tables in README.md and the stats text
  (`/8`).
- **A different strike or fall:** change its `case` in `Director.strike` or `Director.fall`, and its
  name in `src/i18n/`.
- **AI strength:** a level's numbers in `LEVELS` (`game/rules.ts`); keep level 3 as it is (the
  playthrough plays it), check the ladder still holds with a few AI-against-AI games, and update
  the level table in README.md and the difficulty row in the root README. A new level adds its
  name and blurb to `src/i18n/` (`level…`, `blurb…`) and to `LEVEL_TEXT` and `LEVEL_BLURB` in
  `GameScene`.
- **New art for a piece:** its painter in `STATUES` (and its `NECK`) in `scenes/statues.ts`; it
  draws with plain canvas calls, so it can be bundled into a mockup page on its own.
