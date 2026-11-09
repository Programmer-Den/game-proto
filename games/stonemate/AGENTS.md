# Stonemate: guide for agents

Chess with living statues, where every capture plays a scene of its own. Read this before changing
the game, and keep it up to date in the same PR as the change (see the root `AGENTS.md`).

## Current state

- **Modes:** Play White or Play Black against the Stone AI, Two players on one screen (the board
  stays with White at the bottom), and the Capture gallery, which plays any of the 30 capture pairs
  on a three-square stage. **Continue game** comes back to a saved game.
- **Rules:** full chess in `game/chess.ts`: castling, en passant, promotion (a picker with queen,
  rook, bishop and knight; the AI always takes a queen), check, checkmate, and draws by stalemate,
  too little material (kings alone, or one bishop or knight), fifty moves (100 plies without a
  capture or pawn move) and threefold repetition.
- **Stone AI** (`game/ai.ts`): negamax with alpha-beta, material plus piece-square tables, captures
  and promotions ordered first, a capture search to depth 4 at the leaves and a 60,000-node cap.
  `aiLevel()` in `game/rules.ts` picks depth and slack by difficulty: Easy depth 1 with 90 points of
  slack, Normal depth 2 with 15, Hard depth 3 with 0. Among moves within the slack of the best it
  picks at random (through `Math.random`), but never gives up a mate. A move that repeats a position
  a third time scores as a draw. It thinks 450 ms after the board settles, then moves.
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
  `QUICK_MATE` = 25 of your moves), `allScenes` (all 8 signatures seen in games), `hardWin` and the
  hidden `allPairs` (all 30 pairs seen in games, by either side). In a two-player game both sides
  count as the player; wins only count against the AI.
- **Layout:** fills the screen (`setupScaling(game, { fill: true })`). `create` sizes the squares to
  the view's height and centres the board and the panel to its right together. The corner buttons
  sit top right (`setupGame(..., { corner: 'top-right' })`), clear of the board.

## Architecture

- `GameScene` is the only scene. `screen` is `menu`, `play` or `gallery`; each screen is drawn from
  scratch by `showMenu`, `buildPlay` and `showGallery`, which call `clear()`: it destroys every
  object, stops tweens and timers and bumps `gen`, so an `await` that comes back after a screen
  change sees `gen` changed and stops.
- A move: a board tap (`onBoardTap`) picks a statue or plays a legal move; `play(move)` animates it
  on the sprites (`playCapture` or `playMove`, plus the rook when castling), then `pos.make`, then
  `syncPieces()` puts fresh sprites on the board from the position. `busy` holds input while a move
  plays or the AI thinks. After a move: the result is checked, the game saved, and `maybeAi()`
  schedules the AI.
- Buttons are `button(id, ...)`: an interactive rectangle with its text, recorded in `buttons[id]`
  (middle and size in view pixels) for the playthrough. The scene's own `pointerdown` handles the
  board only when no button was hit.
- `Position.history` holds every move with its undo data, so the captured rows, the last move's
  highlight, the save and undo all read it.

## Save keys

- `stonemate-game`: the game under way, `{ mode: 'ai' | 'duo', player: 'w' | 'b', moves: ['e2e4', ...] }`;
  removed when a game ends.
- `stonemate-stats`: `{ wins, losses, draws, pairs: ['nb', ...], scenes: ['joust', ...] }`.
- `stonemate-prefs`: `{ quick }`, the Captures button.
- `stonemate-trophies`: kept by `shared/trophies.ts`.

## Test hooks

The dev build puts `game` on `window`; the playthrough reads `game.scene.getScene('Game')`:

- `state`: `screen`, `mode`, `player`, `turn`, `plies`, `busy`, `selected`, `result`, `inCheck`,
  `captures`, `lastCapture`, `promo`, and `legal` (the legal moves as `e2e4` text while a person is to
  move).
- `buttons`: every button by id (`play-white`, `play-black`, `two-players`, `gallery`, `continue`,
  `undo`, `quick`, `menu`, `new-game`, `result-menu`, `promote-q` and the others, `pair-nb` and the
  others, `back`).
- `board`: `{ x, y, size, flip }`, the board's top-left corner and square size in view pixels and
  whether Black is at the bottom.
- `pos.board`: the 64 squares (0 is a8, 63 is h1), a piece being its kind 1 to 6 (pawn to king)
  plus 8 for Black.

The playthrough plays White against Normal, opens with `e2e4`, follows a short plan and takes the
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

- **A new signature scene:** add the pair to `SIGNATURES` in `game/rules.ts`, a `case` in
  `Director.signature` in `scenes/captures.ts`, its name in `src/i18n/` (en, de), and the
  `allScenes` count follows from `SIGNATURES`; update the tables in README.md and the stats text
  (`/8`).
- **A different strike or fall:** change its `case` in `Director.strike` or `Director.fall`, and its
  name in `src/i18n/`.
- **AI strength:** `aiLevel()` in `game/rules.ts`; keep Normal as it is (the playthrough plays it),
  and update the difficulty row in the root README.
- **New art for a piece:** its painter in `STATUES` (and its `NECK`) in `scenes/statues.ts`; it
  draws with plain canvas calls, so it can be bundled into a mockup page on its own.
