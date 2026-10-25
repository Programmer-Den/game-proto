# Agent guide

This repo is a hub of small Phaser 4 + TypeScript + Vite games. The hub page (`index.html`) links to
each game, and each game lives in its own folder, `games/<name>/`, with its own `index.html`, `src/`,
`e2e/`, `docs/screenshots/`, `README.md` (how to play and its code layout) and `AGENTS.md` (its
current state and architecture, for agents; read it before changing the game). The build, tsconfig,
Playwright config, CI workflows and PR template are shared. The games are Apothecary, in
`games/apothecary/`, Deadline, in `games/deadline/`, Palisade, in `games/palisade/`, Tiny Kingdom, in
`games/tiny-kingdom/`, Hotfoot, in `games/hotfoot/`, Anvilheart, in `games/anvilheart/`,
Broadside, in `games/broadside/`, TinctureTinker, in `games/tincture-tinker/`, Catacomb, in
`games/catacomb/`, Golem Garden, in `games/golem-garden/`, Beehive Baron, in
`games/beehive-baron/`, Wyrmrail, in `games/wyrmrail/`, Shrine Stack, in `games/shrine-stack/`,
Mapmaker, in `games/mapmaker/`, Lanternkeep, in `games/lanternkeep/`, Space Wars, in
`games/space-wars/`, Lane Brawl, in `games/lane-brawl/`, Colonizer, in `games/colonizer/`, Riftblade,
in `games/riftblade/`, Scrapyard Titans, in `games/scrapyard-titans/`, Bramblecrest, in
`games/bramblecrest/`, Ninefold, in `games/ninefold/`, Augury, in `games/augury/`, and Mazewright, in
`games/mazewright/`.

Each game's guide for agents, to read before changing it:

| Game | Guide |
| --- | --- |
| Apothecary | [games/apothecary/AGENTS.md](games/apothecary/AGENTS.md) |
| Deadline | [games/deadline/AGENTS.md](games/deadline/AGENTS.md) |
| Palisade | [games/palisade/AGENTS.md](games/palisade/AGENTS.md) |
| Tiny Kingdom | [games/tiny-kingdom/AGENTS.md](games/tiny-kingdom/AGENTS.md) |
| Hotfoot | [games/hotfoot/AGENTS.md](games/hotfoot/AGENTS.md) |
| Anvilheart | [games/anvilheart/AGENTS.md](games/anvilheart/AGENTS.md) |
| Broadside | [games/broadside/AGENTS.md](games/broadside/AGENTS.md) |
| TinctureTinker | [games/tincture-tinker/AGENTS.md](games/tincture-tinker/AGENTS.md) |
| Catacomb | [games/catacomb/AGENTS.md](games/catacomb/AGENTS.md) |
| Golem Garden | [games/golem-garden/AGENTS.md](games/golem-garden/AGENTS.md) |
| Beehive Baron | [games/beehive-baron/AGENTS.md](games/beehive-baron/AGENTS.md) |
| Wyrmrail | [games/wyrmrail/AGENTS.md](games/wyrmrail/AGENTS.md) |
| Shrine Stack | [games/shrine-stack/AGENTS.md](games/shrine-stack/AGENTS.md) |
| Mapmaker | [games/mapmaker/AGENTS.md](games/mapmaker/AGENTS.md) |
| Lanternkeep | [games/lanternkeep/AGENTS.md](games/lanternkeep/AGENTS.md) |
| Space Wars | [games/space-wars/AGENTS.md](games/space-wars/AGENTS.md) |
| Lane Brawl | [games/lane-brawl/AGENTS.md](games/lane-brawl/AGENTS.md) |
| Colonizer | [games/colonizer/AGENTS.md](games/colonizer/AGENTS.md) |
| Riftblade | [games/riftblade/AGENTS.md](games/riftblade/AGENTS.md) |
| Scrapyard Titans | [games/scrapyard-titans/AGENTS.md](games/scrapyard-titans/AGENTS.md) |
| Bramblecrest | [games/bramblecrest/AGENTS.md](games/bramblecrest/AGENTS.md) |
| Ninefold | [games/ninefold/AGENTS.md](games/ninefold/AGENTS.md) |
| Augury | [games/augury/AGENTS.md](games/augury/AGENTS.md) |
| Mazewright | [games/mazewright/AGENTS.md](games/mazewright/AGENTS.md) |

## Feedback and issues

Feedback comes in as issues filed through the forms in `.github/ISSUE_TEMPLATE/` (bug report,
gameplay feedback, feature wish). Labels have short names, and each label's group is the start of
its description: **Game** (the folder name, like `apothecary`, plus `hub` and `shared`), **Type**
(`bug`, `gameplay`, `feature`, `refactor`, `assets`, `docs`, `ci`), **Priority** (`high`,
`medium`, `low`) and **Status** (`needs-info`, `duplicate`, `wontfix`). Every issue carries one
Game label and one Type label (`bug`, `gameplay` or `feature`); Priority and Status are optional.
The form sets the Type label and `.github/workflows/issue-labels.yml` adds the Game label from the
form's Game dropdown. Labels are defined in `.github/labels.json` and the Labels workflow
(`.github/workflows/labels.yml`) syncs them on main, deleting any label not in that file, so labels
are never edited on GitHub. A PR that fixes an issue says `Fixes #<number>`. Each Game label has its
own public GitHub Project, plus one "All feedback" Project, with the title, short description and
README listed in `.github/projects.json`. Each Project's built-in Auto-add workflow files issues
and PRs into it (filter `is:issue,pr is:open label:<game>`, or no label for "All feedback"), and
its "Item added to project" workflow, set to Issue only, gives new issues the status Todo. Since
Auto-add misses the Game label the Issue labels workflow adds, that workflow also adds each issue
to "All feedback" and its game's Project with the status Todo. Run that workflow by hand with an issue
number to file an older issue again. The **Project status** workflow (`.github/workflows/project-status.yml`) puts each open PR into its
Projects with the status In Progress. Both use the `PROJECTS_TOKEN` secret (a classic token with only
the `project` scope). To see what is on the boards, start the **Project report** workflow
(`.github/workflows/project-report.yml`) by hand; it prints each Project's items and their Status
to its log and run summary. To create a new game's Project, start the **Project setup** workflow
(`.github/workflows/project-setup.yml`) by hand once its entry is on main: it creates every Project in
`.github/projects.json` that doesn't exist yet, with its short description and README, makes it public
and tries to link it to the repo (the run summary says if the link has to be made by hand).

- **Every PR needs labels.** It carries at least one Type label for what it changes (`bug` for a
  fix, `feature`, `gameplay`, `refactor`, `assets`, `docs`, `ci`) and at least one Game label for
  where (a game, `hub` or `shared`). The `type-and-game` job of the **PR Template Validation**
  workflow (`.github/workflows/pr-template-validation.yml`) reads each label's group from
  `.github/labels.json` and fails until both are set, so add them right after opening the PR.
- **Never create a new label.** Use only the labels in `.github/labels.json`, and never add one
  on GitHub or apply a label name that isn't in that file (GitHub creates it silently). The
  `type-and-game` check fails on any label not in the file. The one exception is a PR that adds a
  new game: it adds that game's label (its folder name, description `Game: <Name>`) to
  `.github/labels.json` (see "Add a game" below) and carries it.

## Work on one game at a time

- **Keep games apart.** A game's code stays in its folder and never imports from another game.
  Something two games both need can move to a shared folder once a second game actually needs it.
- **Keep the game's `AGENTS.md` up to date.** Each game's `games/<name>/AGENTS.md` describes what
  is built today, how the code fits together, its save keys, its test hooks and how to make common
  changes. A PR that changes a game updates that file in the same PR wherever it no longer matches:
  a new or removed feature, file, type, save key or test hook, or a recipe that changed. A
  `CLAUDE.md` next to it imports it (`@AGENTS.md`), like the root one does.
- **Say which game a PR is for** in its title or summary, and keep its screenshots in that game's
  `docs/screenshots/`.
- **Keep screenshots few and small.** Every committed image stays in the history and in every
  clone, even after it is deleted, and screenshots already make up most of the repo's size. So:
  - **Few:** add at most 4 new screenshots per PR, one per thing the PR adds that a reader can't
    picture from the summary. Show only the new element, reuse a screenshot already in the folder
    when it still shows the change, and replace an outdated one under the same name (it doesn't
    count as new) rather than adding another. A refactor, fix or balance change with nothing new to
    see gets none.
  - **Small:** save screenshots as WebP, at most 200 KB each and at 960x540 (540x960 for an
    upright game) unless a detail needs more, never wider or taller than 1280 pixels. Capture as
    usual, then run `npm run screenshots -- <file>...`: it scales each image down to 960 pixels on
    its longer side (`--max 1280` for a detail), writes `<name>.webp` next to it (a 960x540 game
    shot is usually 40-80 KB, against 300-500 KB as PNG) and deletes the original (`--keep` keeps
    it). Any other committed image, like a game's `cover.png`, stays under 500 KB and 1280 pixels.
  - The **Screenshots** workflow (`.github/workflows/screenshots.yml`, running
    `scripts/check-screenshots.mjs`) fails a PR that breaks these limits; run
    `node scripts/check-screenshots.mjs origin/main` to check before pushing. GitHub shows WebP
    images in PR descriptions and READMEs like any other image.
- **Add a game** by creating `games/<name>/` with an `index.html` that loads `./src/main.ts`, a
  `README.md`, an `AGENTS.md` (current state and architecture) with a `CLAUDE.md` that imports it,
  a `cover.png` (a 16:9 screenshot), a `src/howToPlay.ts` handed to `setupGame(game, { howToPlay })` and an `e2e/playthrough.spec.ts` that plays its first round,
  and it is played by the shared `.github/workflows/playthrough.yml`, which finds every
  `games/<name>/e2e/playthrough.spec.ts` on its own, so a new game needs no workflow of its own. Give it a `favicon.svg` linked from its `index.html`: the orange bear from the hub's
  `favicon.svg` (same ears, head, dot eyes and muzzle, 32x32 viewBox) with one prop for the game,
  like Apothecary's plague doctor hat and beak. Then add a card for it in the hub's `index.html` (the hub sorts its cards by name; with its text and cover description in
  `shared/i18n/en.ts` and `de.ts` as `<game>Card` and `<game>Cover`, marked `data-i18n` and
  `data-i18n-alt`, and its genres for the hub's genre filter in `data-genres`) and in `e2e/hub.spec.ts`, a
  Playwright project in `playwright.config.ts`, a row in the README's table of games and a row in
  the table of guides above. Add its Game label (its folder name, description `Game: <Name>`) to `.github/labels.json` (the Labels
  workflow creates it on main), its Project (title, short description and README) to `.github/projects.json`, its name to the
  Game dropdown of the three issue forms in
  `.github/ISSUE_TEMPLATE/` (before `Hub page` and `Shared / all games`, then raise each form's
  `default` by one so it still preselects Shared), and its name and label to the map in
  `.github/workflows/issue-labels.yml`. Give it a two-letter progress file code in
  `shared/saveCodes.ts` and draw its app icons with `node scripts/pwa-icons.mjs <name>` (the build
  fails without either). Once that is merged, start the **Project setup** workflow to create
  the game's GitHub Project, then remind **Chriszly**, in the PR's "Notes for reviewers" and in your
  reply, to finish it by hand: the Auto-add workflow with the filter
  `is:issue,pr is:open label:<game>`, the "Item added to project" workflow set to Issue only with
  Status Todo, and the link to the repo if the run summary says it is missing. Vite picks
  up `games/*/index.html` on its own. Keep save keys and other browser storage prefixed with the
  game's folder name (`<name>-...`), since every game shares the hub's origin and the hub's ⚙ on a
  card deletes a game's progress by that prefix (`shared/progress.ts`).
- **Honour the hub's settings.** Every game calls `setupGame(game)` from `shared/setupGame.ts`
  right after creating its `Phaser.Game`, which applies the frame cap, the FPS readout, reduced motion, full screen and the sound button, turns off the browser's right-click menu, and covers
  the page with the shared loading, start and pause screens (`shared/startScreen.ts`): the game's
  scenes stand paused until Start is pressed, and the pause button, P or leaving the tab pause them. A game
  hands its How to play (`games/<name>/src/howToPlay.ts`, typed by `shared/howToPlay.ts`) to
  `setupGame(game, { howToPlay })`, and the start and pause screens show it behind a How to play
  button; a change to the game's goal, controls or core loop updates that file in the same PR. Each game also implements the difficulty itself: scale one or two of its own balance
  numbers with `byDifficulty(easy, normal, hard)` from `shared/settings.ts`, keep Normal exactly as
  designed (the playthrough runs on Normal), and add the game's row to the difficulty table in the
  README. Skip camera shake and flashes, and hold blinking or jittering effects still, when
  `settings.reduceMotion` is on. A new setting goes into `shared/settings.ts` (its type, default and
  `SETTING_FIELDS` row, which the hub panel shows on its own) and then into every game.
- **Play with a controller.** `shared/gamepad.ts` reads game controllers (standard layout) and
  moves the focus on the hub and the shared start, pause and How to play screens and the sound menu
  (`moveFocus`, `pressFocused`), and `shared/padCursor.ts`, added by `setupGame`, steers a cursor
  over the game that sends real mouse and pointer events, so a game needs nothing of its own for it.
  The hub's Controller setting turns both off and Cursor speed sets the cursor's pace. Tests stand
  in for a controller by replacing `navigator.getGamepads` (`fakePad` in `e2e/hub.spec.ts`); a
  playthrough never uses one.
- **Make sound in code.** `shared/audio.ts` plays every game's sound, with no audio files:
  `sounds({ name: SoundDef })` gives a game a `play(name)` for its own table of synthesized effects
  (each with its own rate limit, at most 12 at once), `ui` has the shared `click`, `coin` and the
  `refuse` buzz that every game plays for an action it can't do, and `playMusic(song, part)`,
  `playSting` and `stopMusic` play chiptune written as note text (a `Song` with calm, battle, boss
  and sting parts). `setupGame` adds the sound button (and the M key, which mutes) to the corner row
  (`shared/corner.ts`: full screen, sound and pause, 12px plus the safe area from the edges); the
  button opens the sound menu with the Music and Effects volumes and Mute, the pause screen sets the
  same volumes, and the hub's settings hold them (`music`,
  `effects`, `muted`). Sound starts on the first tap or key press, and never under browser
  automation, so playthroughs run as before. A game plays one sound per volley rather than per
  bullet, only for what the player can see, only for the player's own actions where the AI shares
  the code, and nothing while it replays time or restores a save; its `AGENTS.md` lists its songs,
  its sound table and where they play. `docs/sound-plan.md` has the planned music and sound list
  for every game, with where each sound is triggered.
- **Speak the player's language.** The hub's Language setting (`shared/settings.ts`) picks British
  English (`en`, the source), US English (`en-US`) or German (`de`), and `shared/i18n.ts` translates
  with it: `translator({ en, 'en-US': enUS, de })` gives a `t(key, vars)` for a set of texts kept in
  an `i18n/` folder, `en.ts` with the British English source, `de.ts` typed
  `Translation<typeof en>` (so `npm run build` fails on a missing key) and `en-US.ts` typed
  `Partial<Translation<typeof en>>` with only the texts spelled differently in US English. Texts take
  `{name}` placeholders and plural forms (`{ one: '{n} play', other: '{n} plays' }`); show numbers
  and dates with `formatNumber` and `formatDate` (or `toLocaleString(locale())`), never by hand. The
  shared texts (hub page, Settings panel, loading, start, pause and How to play screens) are in
  `shared/i18n/`; the hub page marks its text with `data-i18n="key"` (`data-i18n-alt` for an
  image's alt text, `data-i18n-label` for an `aria-label`). A game moves its own text into `games/<name>/src/i18n/` one game per PR, like
  screen scaling, and from then on gives every new text its German (and, where the spelling
  differs, US English) entry in the same PR; game logic compares ids, never translated text. The
  **Translations** workflow (`.github/workflows/translations.yml`, running
  `scripts/check-translations.mjs`) fails a PR whose translation has other placeholders or plural
  forms than English, or is left the same as English (a text that really is the same goes in that
  file's `keepEnglish`), and warns where a text is much longer than English; run
  `node scripts/check-translations.mjs` before pushing. Playthroughs and other tests run in British
  English, the default language (the browser's own language is not used).
- **Every game is an app.** The hub and every game install as apps of their own that play offline
  (`scripts/pwa.ts` makes each game's manifest from its `<title>` and background colour and writes
  the service worker; `shared/install.ts` registers it from `setupGame`, and the shared start and
  pause screens show its Install button, also opened by the Install on its hub card as `?install`),
  so a game needs nothing for it beyond its code and icons (see "Add a game"). The hub's Updates
  setting (`updates`) holds new versions back (`scripts/sw.js`), and Update now lets one through. Keep every file a game loads inside the build (no
  files fetched from other sites), so it still plays offline. Its progress exports and imports from
  the hub as an encrypted `.gh<code>` file (`shared/saveFile.ts`), which carries every storage key
  with the game's prefix, and as a progress code, a QR code or copied link with the same data
  (`shared/progressCode.ts`, packed by `shared/pack.ts`, which rounds numbers to six significant
  digits, and scanned inside the hub with `shared/scanner.ts`) except keys too big
  for a QR code (`fileOnly` in `saveFile.ts`: a game's `<game>-replays`), which only the file carries.
- **Play counts come for free.** `setupGame` also bumps the game's public play counter
  (`shared/playCount.ts`, keyed by the game's folder name) and the hub shows the count on its card,
  so a new game needs nothing for it. Tests never count: browser automation skips it.
- **Trophies.** `shared/trophies.ts` gives every game the same trophies: a game lists 6 to 10 of
  them (id, `bronze`, `silver` or `gold` tier, an emoji icon, `hidden` until earned) with
  `trophySet` in `games/<name>/src/trophies/index.ts`, exported as `trophies`, with their texts in
  `trophies/i18n/` (`en.ts`, `de.ts` and, where the spelling differs, `en-US.ts`; the name keyed by
  the id, what earns it by `<id>Text`). That file imports nothing else from the game, since the hub
  loads every game's (`import.meta.glob`) for each card's count and the Trophies shelf in its
  header. The game hands `trophies` to `setupGame(game, { howToPlay, trophies })`, which adds a
  Trophies list to the start and pause screens, and calls `award(trophies, id)` when one is earned:
  it saves it under `<game>-trophies`, shows a toast at the top of the page and plays the shared
  `ui('trophy')` fanfare, once. Pass `{ quiet: true }` while replaying time or restoring a save. Pick
  milestones of a first hour and a few for long play, list them in the game's `AGENTS.md`, and
  bring games over one per PR (`ls games/*/src/trophies/index.ts` lists the games that have them).
  A playthrough may assert a trophy its first round earns.
- **Time played comes for free too.** `setupGame` adds up the time the game runs on this device
  (`shared/playTime.ts`, under `hub-playtime`), not on its start or pause screen, nor with the tab
  hidden or the turn-phone hint up, and the hub shows it on the card, beside the starred games
  (`shared/favourites.ts`, `hub-favourites`). Both stay on the device: `hub-` keys never go into a
  progress file or code. Browser automation doesn't count it unless a test sets
  `window.countPlayTime`, so a game needs nothing for it.
- **Fit every screen.** A game stays sharp and fills the screen from an upright phone to a 4K
  monitor by calling `setupScaling(game)` from `shared/scaling.ts` right after `setupGame(game)`
  (`grep -l setupScaling games/*/src/main.ts` lists the games that do; bring the others over one game per PR). The canvas then has
  `renderScale` canvas pixels per game pixel and every camera is zoomed to match, so: lay out with
  `viewSize(scene)` rather than `scene.scale`, read the world through `pointer.worldX/Y`,
  `getWorldPoint` and `worldView` rather than `pointer.x/y` or `scrollX/Y`, give a camera that
  follows, scrolls or has bounds `scrollingCamera(camera)` and keep scroll-factor-0 objects off it
  (`splitHudCamera(scene)` draws them with a second, fixed camera; read pointers with `viewPoint`), multiply a game's own camera zoom by `renderScale`, and
  paint canvas art at `sharpRes(w, h, res)`. On a phone held the wrong way for the game the
  whole page (the canvas and the shared screens over it) is turned a quarter round to fill the
  screen, and taps are turned back before Phaser reads them, so games need nothing for it; with the
  hub's Phone held the wrong way setting on Ask me to turn it, a hint to turn the phone covers the
  paused game instead. Shared overlays pin to the safe area with `var(--safe-left, env(...))` (and
  `--safe-right`, `--safe-top`, `--safe-bottom`), which follow the turn. `e2e/screens.spec.ts` picks the game up on its own and checks it on five screens; the
  **Screens** workflow (`.github/workflows/screens.yml`) runs it in one job per game, on a PR only for
  the games whose folder changed (every game when `shared/` or the test changes).
  Give its `index.html` the same `100dvh` and `touch-action: none` styles as Apothecary's.
  **Fill every screen shape.** A game also takes the screen's shape, with no bars at its sides, by
  calling `setupScaling(game, { fill: true })` (`grep -l 'fill: true' games/*/src/main.ts` lists the
  games that do; bring the others over one game per PR). Its view keeps the designed size as its
  smallest and grows the other way, up to 2.4:1 (a 960x540 game is 960 to 1296 wide and 540 to 720
  tall), picked once when the game starts. So lay out every scene against `viewSize(scene)`, never
  the designed size: paint backgrounds and the world over the whole view, pin bars and buttons to the
  view's edges, centre panels and dialogs in the view, and put a play area that was laid out for the
  designed size in `viewFrame(scene)`, the designed-size rectangle in the middle of the view. A
  scrolling world shows more of itself instead. A game laid out for upright screens too (Ninefold)
  adds `bothWays: true`: its view turns round on an upright window and again when the phone turns,
  with no hint to turn it, so it picks its layout from `viewSize` and lays out again on the scale
  manager's `resize` event. The Screens check then also fails a filling game that
  leaves bars, and the playthrough, at 960x540, plays as before.
- **Watch AI.** A game whose AI can play every side supports `?watch` with `shared/watch.ts`: when
  `watching` is set, hand the player's side to the AI and lift the fog, call `mountWatch` once the
  match starts (with each side's name and colour and the match clock), run the sim
  `watchSteps()` times per frame (0 while the panel holds the match, so pausing and speeding up never change the
  rules), and report AI decisions with `aiLog(side, text)` (a no-op outside watch mode). Then add its
  row to the Watch AI table in the README and its path to `WATCH` in `e2e/hub.spec.ts`, which opens
  it with `?watch`. The hub has no link to it: it is opened by URL only. A game's playthrough never
  uses `?watch`.
- **Never use a red cross.** No game art, icon, button, cover or favicon (the hub's included) may show a
  red cross: no red plus, red-cross health or medic symbol, or red crosshair. Use a green cross (or
  another colour) for healing and aiming marks instead.

Each game's playthrough follows the rules below. They are written for Apothecary; a new game keeps
the same rules with its own first round, files and state.

## Keep the playthrough test working

`games/apothecary/e2e/playthrough.spec.ts` plays one round of the loop in headless Chromium: it opens the recipes,
harvests, refines, brews and sells potions to a customer. The **Playthrough Apothecary** workflow
(`.github/workflows/playthrough.yml`) runs on every PR (not on pushes to main) and reports one
required check, `Playthrough`. It plays each game whose `games/<name>/` folder changed, so a PR for
one game only plays that game. If the workflow itself, the shared code (`shared/`, which every
playthrough runs through) or the build setup (`package.json`, `package-lock.json`, `tsconfig.json`,
`tsconfig.e2e.json`, `vite.config.ts`, `playwright.config.ts`) changes, every game is played. A game that did not change is not played, and the check still passes. The **Hub** workflow (`.github/workflows/hub.yml`) runs `e2e/hub.spec.ts`: the hub's own checks
in one job, and opening each game from its card in one job per game, on a PR only for the games
whose folder changed (every game when the hub page, its test or `shared/` changes), reported as
one check, `Hub open`. The playthrough is the check that the core loop can still be played, so it has to stay accurate.

- **Change the test in the same PR as the game.** A change to gameplay, layout, input or balance
  that the playthrough depends on goes in together with its test update. That includes rules and
  numbers in `games/apothecary/src/game/` (items, recipes, grow, refine and brew times, prices, carry and station
  capacity), positions in `games/apothecary/src/scenes/layout.ts`, controls and marker behaviour in
  `games/apothecary/src/scenes/GameScene.ts`, and the `GameScene` fields the test reads (`state`, `player`,
  `pointerTarget`). Don't leave a red playthrough for a follow-up PR.
- **Keep it to the first round.** The playthrough covers harvesting, refining, brewing and selling
  to a customer, and nothing bought with the coins. A change to that round (a new plant, recipe or
  step a first round goes through) gets a step in the test that asserts its effect on the game
  state. Upgrades, expansions, craftsmen, belts and other purchases stay out of it.
- **Never skip or loosen the test to get green.** No `test.skip`, `test.fixme`, `.only`, removed
  assertions, `continue-on-error`, retries, or narrowing a workflow's paths so it stops running on
  changes to its game.
  Don't raise timeouts or tolerances unless the failure is shown to come from a slow runner rather
  than the game, and say so in the PR. If the test is wrong, fix the test; if the game broke, fix
  the game.
- **The start screen stays out of the way.** Under browser automation (`navigator.webdriver`) the
  shared start screen is skipped and the game starts as soon as its first scene has drawn, so a
  playthrough needs no step for it; `e2e/hub.spec.ts` checks the screen itself by setting
  `window.showStartScreen` first.
- **Drive the game through real inputs.** The test walks by clicking, like a tap on a phone, and
  only reads state through `window.game` (exposed by the dev build in the game's `src/main.ts`). Don't write to
  game state from the test or add shortcuts that bypass the real controls.
- **Keep it deterministic.** The test owns the game clock (`page.clock`): game time only moves when
  the test advances it, in fixed 64ms animation frames, so a slow runner plays exactly like a fast
  one. `Math.random` is seeded so customer orders repeat. Keep game timing on
  `requestAnimationFrame`, Phaser's clock or `performance.now`, and new randomness behind
  `Math.random`, so runs stay reproducible. Waits are measured in game time, not real time.
- **It plays at 4x speed.** The test paces game time at `PLAYTHROUGH_SPEED` times real time (4 in
  CI, set in the workflow), so the recorded video is a 4x time-lapse. It renders with Phaser's
  canvas renderer, because software WebGL on a runner without a GPU is too slow for that. The end
  of each run logs the speed it reached (`Played 47s of game time at 4.0x`); a busy runner can fall
  short of 4x, which slows the video but never changes the result.
- **Keep the PR screenshots honest.** The test saves milestone screenshots; when the look of the
  loop changes, refresh the `games/apothecary/docs/screenshots/playthrough-*` files from a fresh run
  (shrunk to WebP with `npm run screenshots`, and the README's links updated to match).

## Run it locally

```sh
npm ci
npx playwright install chromium   # once per machine
npm run test:e2e                  # starts the dev server on port 5173, checks the hub and plays every game
npx playwright test --project apothecary   # one game only
```

- It reuses a dev server already running on port 5173, so you can keep `npm run dev` open.
- `CPU_THROTTLE=4 npm run test:e2e` slows the browser's CPU to simulate a slow CI runner. The run
  takes longer but must play out the same; if it doesn't, something escaped the test's clock.
- `PLAYTHROUGH_SPEED=1 npm run test:e2e` plays at normal speed, handy with `--headed` to watch it.
- `npx playwright test --headed` shows the browser while it plays; `--debug` steps through it.
- Also run `npm run build` before pushing. It typechecks the games and `shared/` (`tsconfig.json`),
  then the e2e tests and the Vite and Playwright configs (`tsconfig.e2e.json`), then builds.

## Debug a failure

1. Read the error. Every wait has a name (for example `walk to 645,262` or `potions brewed`), and a
   failed wait prints where the doctor's feet were and the game state at that moment.
2. Open the run's `playthrough-<name>` artifact on the workflow run's summary page. It has `video.webm`, the
   milestone screenshots, `trace.zip` on failure and the HTML report (`playwright-report/index.html`).
   Open a trace with `npx playwright show-trace trace.zip` to see each step, the page and the console.
3. Reproduce locally with `npm run test:e2e`. Because the clock is controlled, a CI failure should
   reproduce locally; if it only fails in CI, try `CPU_THROTTLE=4` and look for timing that does
   not go through the browser's clock.
4. Decide whose fault it is. A walking target that moved or a marker that changed means the test
   needs the new coordinates from `games/apothecary/src/scenes/layout.ts`. Changed counts, recipes or prices mean the
   test's expectations need updating. A step that never completes in the game itself is a game bug.
