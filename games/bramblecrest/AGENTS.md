# Bramblecrest: guide for agents

How Bramblecrest is built and where things stand, for agents changing it. README.md covers how to
play. Keep this file up to date with any change to the game, per the root AGENTS.md.

## Current state

Bramblecrest is a top-down adventure, chapters one and two of a small kingdom at night. The knight
walks a 32-pixel tile grid by keys or by tap (A* to the tile, or next to a person, chest, sign,
block, door, bush, bell, boulder, cracked wall or foe, then acts on it). The quest (`QUESTS` in
`state.ts`) runs `start` (talk to Elder Wren), `blade` (take the Old Blade from the chest by the
shed), `thorns` (cut the thorns over the village's north gate), `shrine` (find and clear the Sunken
Shrine), `return` (tell the elder), `done` (chapter one's end card; the elder then tells of the
bell), `bell` (ask Old Sedge), `belfry` (he gives bellseeds; find and clear the Drowned Belfry),
`home` (tell the elder) and `end` (chapter two's end card, then the post-game: free roaming, the
moonstone page and the hourglass trials).

Implemented today:

- Five maps in `src/game/maps.ts`: Mossford (the village: the elder, Pip, Marla the baker, Biscuit
  the cat, the shed's chest, lamps, the well and a pond), Bramble Woods (the path from the gate to
  the shrine's arch, a river crossed on the hookvine, a thorn gate on the path with a line of trees
  across the woods either side, slugs and moths), Glimmer Fen (the hermit Old Sedge, his hut, three statues and a wisp) and the Sunken Shrine
  (eight rooms: entry, key room, hall, block room, hookvine room, pit room, a hidden alcove and the
  boss hall), and the Drowned Belfry (entry, hub, the bells room behind a cracked wall, a flooded
  room crossed on the hookvine, a hollow behind a cracked wall and the Bellwraith's hall, through a
  key door). Its entrance is the ruined bell tower in the fen's north-east, behind two boulders.
  Each map has a darkness, exits (some behind a flag) and saved flags for what changed.
- The knight: walking (`WALK_SPEED`), a roll with no hits taken (`ROLL_*`), a sword swing that hits
  foes and bulbs and cuts bushes and thorns (`SWING_*`), and the hookvine (`VINE_*`, `PULL_SPEED`):
  it flies in the facing direction, over low tiles (`LOW`: water, pits, bushes, the boss ring),
  pulls the knight to a golden post (not the one they stand on), yanks down a raised bulb and stuns
  a foe. Hearts are counted in halves; a fall wakes the knight at the map's spawn, healed. The
  spawn is where the knight came into the map, or, after a reload, where the game was last saved
  (`create` calls `enterMap` with `keepSpawn` false). A fall and an exit in the same frame start
  one fade only (`fadeTo` returns while `fading`).
- Items: the Old Blade, the Hookvine, lantern oil (a bigger lantern light), small keys and heart
  vessels, all from chests (`openChest`), plus hearts dropped by cut bushes.
- Bellseeds (`items.seeds`, a count in `seeds` up to `MAX_SEEDS`): Old Sedge gives and refills
  them. `plantSeed` drops one `PLANT_REACH` in front of the knight (at their feet against a plain
  wall); after `FUSE_MS` it bursts (`burst`): it breaks `BREAKABLE` tiles (`boulder` outdoors,
  `crack` indoors) within `BURST_PX`, cuts bushes, hits foes twice, hurts the knight if close, and
  tips the Bellwraith's bell. Broken rock is saved as `broke-<map>-<x>-<y>` and cleared again in
  `enterMap`. Cut bushes and beaten foes sometimes drop seed pods (one seed each).
- Belfry puzzles: three bell props (`note` 0 to 2) rung with the sword in `BELL_ORDER`; a wrong
  bell starts over, the right tune sets `bells`, which lifts the bars to the flooded room.
- Shrine puzzles: a key door, a pushable block onto a pressure plate that lifts iron bars (a block
  on a plate stays), shut doors that close behind the knight while their room still has foes (only
  once the knight's whole feet box, `FEET`, is in the room, so a door never shuts on them), and
  pit crossings by hookvine posts.
- Foes (`src/scenes/foes.ts`): slugs, moths (they fly over water and pits), thornlings (they
  stand still and spit seeds) and frogs (they sit, then leap at the knight). Dungeon foes stay
  beaten (`foe-<i>` flags in the shrine, `belfry-foe-<i>` in the belfry; `DUNGEONS` lists them).
- The Thornmother: a ring no blade cuts, three bulbs raised one at a time (`BULB_*`), thorn volleys
  that speed up as bulbs fall (`VOLLEY_MS`) and summoned slugs (`SUMMON_MS`, by difficulty). A bulb
  yanked down by the hookvine takes `BULB_HP` sword hits. Beating her clears the ring, gives a
  heart vessel, reveals a moonstone and opens the hall's top exit.
- The Bellwraith (`wraith`, `updateWraith`): a great bell that hovers after the knight
  (`HOVER_MS`, `HOVER_SPEED`), shudders (`DROP_MS`) and slams down (`SLAM_PX`), then lies there
  (`BELL_DOWN_MS`). A bellseed bursting next to the downed bell tips it over and shows the wraith
  for `EXPOSED_MS`; one sword hit sends it back up. `WRAITH_HP` hits beat it: the `wraith` flag, a
  heart vessel and a moonstone. It calls moths (`SUMMON_MS`) and drops seed pods when the knight is
  short.
- Thirteen moonstones (`MOONSTONES`; `CHAPTER_ONE_STONES` of them in chapter one), placed in
  `maps.ts` and `talk.ts`. The HUD counts against chapter one's eight until chapter two starts
  (`stonesToFind`); the new five need bellseeds. Most are hidden behind something the player has
  to notice; each chapter's end card has three endings by how many were found. Stones in
  `AFTER_BOSS` show once their boss is beaten. **Keep the secrets in code**: the README and this file only hint at where stones are, so
  don't list their places or triggers in docs, PRs or commits.
- The night (`src/scenes/light.ts`): a dark layer with holes for lights, an added warm glow and a
  haze at the view's top and bottom edges for the miniature look. Lamps, windows, braziers,
  glowing mushrooms, candles, moonstones, seeds, bellseeds and the knight's lantern are
  lights, and `flashes` are short-lived ones (a burst, a ringing bell; none with reduce motion).
- The post-game. The moonstone page (`toggleStones`, drawn by `Hud.showStones`): N or a tap on the
  counters' plate (`Hud.plateAt`) opens it any time; it lists each map (`MAP_IDS`) with its stones
  found and in all (chapter two's, `chapter: 2` in `maps.ts`, only once it starts) and, after
  chapter two, each trial's best time. While it is open the game stands still (`Hud.covered`, like
  the end card). The hourglass trials: each dungeon has an `hourglass` tile by its entry, shown and
  solid once the quest reached `end`. Reading it (`hourglassAt`, `interactAt`) ends with the `trial`
  talk effect, `startTrial`: `trial` is set and the map is built again, ignoring the beaten foes'
  flags and the boss flag, so every foe, the ring and the boss come back. Its boss is harder by the
  factors in `TRIAL` (`foes.ts`). `trial.ms` counts play time (not while talking, faded or covered)
  and shows as the HUD's clock; beating the boss calls `trialWon` instead of the story's ending
  (no flag, quest step, heart or stone) and keeps the best time in `state.trials[map]`. Leaving the
  map (`enterMap` with another id) or a fall ends the trial with the `trialLost` toast.
- The HUD (`src/scenes/hud.ts`): hearts, moonstones, keys (in a dungeon), bellseeds, the journal
  line (the quest's objective), place banners, toasts, the touch buttons, the floating touch stick,
  the dialog box, the trial's clock (top middle), the moonstone page and the end card. The counters sit side by side, and a longer word (German
  "Schlüssel") pushes the next one along and widens their plate.

## Sound

All in code through `shared/audio.ts` (no audio files), in `src/audio/`:

- `music.ts`: one `Song` per kind of place, picked by the map's theme in `GameScene.playAreaMusic`
  (called at the end of `enterMap`, when a boss wakes and when one is beaten):
  - `VILLAGE` (`calm`): Mossford, a lullaby waltz in F major at 120 BPM in eighths, a triangle
    lead over a soft square pad, no drums.
  - `WILDS` (`woods`, `fen`): 84 BPM, pulse arpeggios and a shaker; the Woods in A Dorian, the Fen
    sparser in D Dorian. One song, so walking between them changes at the next bar.
  - `DEEP` (`shrine`, `belfry`): 72 BPM slow minor loops over a bass drone with a drip for drums;
    the Shrine in D minor, the Belfry in E minor with a bell-like lead.
  - `BOSS` (`thornmother`, `bellwraith`): 140 BPM, plays while a boss is awake (A minor, E Phrygian).
  - `STINGS`: `item` (a chest), `victory` (a boss beaten), `fall` (out of hearts) and the chapter
    end card's `endAll`, `endSome` and `endFew`, by the same thresholds as its ending text.
- `sounds.ts`: the effects table `sfx`, and where each plays in `GameScene.ts`: `swing`
  (`startSwing`), `cut` (`cut`, lower for thorns), `roll` (`startRoll`), `vine` (`fireVine`),
  `latch` and `pull` (`updateHook`, a post; `latch` alone on a foe), `plant` and `tick`
  (`plantSeed`, `updateBombs`: every 300ms, then every 100ms while it flickers), `boom` (`burst`),
  `crumble` (`breakRock`), `scrape` (`push`), `chime` (a plate, the bells' tune), `unlock` (a key
  door), `door` (a room's shut door closing or opening, in `updateDoors`; never on entering a map),
  `creak` (`openChest`, with the `item` sting), `stone` (`gainStone`), `glint` (a buried stone dug
  up), `heart` and `pod` (`pickups`; `pod` also for Sedge's refill), `blip` (each line of talk, in
  `openDialog` and `nextLine`, pitched by a hash of the speaker's name), `bell` (`ringBell`, pitched
  G, C and E by the bell's `note` through `BELL_PITCH`, so the right tune is a falling chord; low
  for the Bellwraith's bell struck while down), `wrong` (the wrong bell), `hit` and `pop`
  (`hitFoe`: only the knight hits foes), `hurt` (`hurt`), `wake` (after a fall), `spit` (a
  thornling), `volley` (one per Thornmother volley), `twang` (`yank`), `squelch` (`hitBulb`),
  `rattle` and `clang` (the Bellwraith's drop and slam), `topple` (`tipBell`), `wail`
  (`hitWraith`), `wisp` (the wisp hops on) and `swell` (`checkExits`, walking into another map).
- `ui('refuse')` for a locked or barred door, the thorny door, an empty chest, no bellseeds left and
  the hourglass while its trial runs;
  `ui('click')` for the end card's buttons (`hud.ts`) and opening the moonstone page; the `swell` effect also
  plays when an hourglass trial starts.
- Nothing plays while a map is built or a save loads (`enterMap` only starts the music). There is
  no `?watch` mode, footsteps or ambience.

## Architecture

- `src/main.ts` creates the game (960x540, `Phaser.AUTO`), calls `setupGame(game, { howToPlay })`
  and `setupScaling(game, { fill: true })`, and exposes `window.game` in dev builds.
- Fill mode: the view takes the screen's shape (960 to 1296 wide, 540 to 720 tall; read it with
  `viewSize`), so lay nothing out against `VIEW`. The world camera just shows more of the map; a
  map smaller than the view (the Fen on an ultrawide) is zoomed in by `enterMap` just enough to
  fill it. The night's canvases take the view's shape (320 wide) and are stretched over all of it.
  In the HUD the hearts plate is pinned top left, the journal line top right, the touch buttons
  keep their distance from the bottom-right corner (`Hud.btn`, used by `buttonAt` too), the place
  name, toasts and the talk box are centred (the box on the bottom edge), and the end card is
  laid out for 960x540 inside `viewFrame` with its shade over the whole view. At 960x540 nothing
  moves.
- `src/audio/`: the songs and the sound table (see Sound).
- `src/howToPlay.ts`: the How to play text in British English and German, picked with `byLanguage`
  (US English uses the British one, since no word in it is spelled differently).
- `src/i18n.ts` and `src/i18n/`: every text on screen (`shared/i18n.ts`). `i18n/en.ts` is the
  British English source, `i18n/de.ts` the German and `i18n/en-US.ts` the US spellings (none so
  far). `t(key, vars)` shows a text in the hub's language and `TextKey` types the keys. Place and
  person names and signs are translated when a map is built (`maps.ts`), lines when a person is
  talked to (`talk.ts`), and `OBJECTIVES` holds the journal line's keys. Logic compares ids, never
  text.
- `src/game/` is plain data and rules with no Phaser: `maps.ts` builds each map with a small
  `Builder` (rect, border, ellipse, seeded scatter, props) into a `MapDef`; `state.ts` holds the
  save and quest; `talk.ts` returns each person's lines and an effect by quest stage; `path.ts` is
  8-direction A* with no corner cutting.
- `src/art/paint.ts` paints every sprite onto canvases at `sharpRes` (soft 3D: shaded balls and
  boxes with shadows); `texScale(key)` gives the display scale. `src/art/ground.ts` paints a whole
  map's ground into one texture, `ground-<map id>`; repainting it (the boss ring) needs the ground
  image's `setTexture` again.
- `src/scenes/GameScene.ts` (scene key `'Game'`) does the rest: `enterMap` builds a map's sprites,
  foes, doors and lights from its `MapDef` and the saved flags; `update` runs input, the knight,
  the hookvine, foes, seeds, the boss, the wisp, pickups, exits, the world's depth sort, the night
  and the HUD. Sprites are depth-sorted by their feet's y; the night is at 9000 to 9002 and the
  HUD at 10000, both with scroll factor 0 on the HUD camera (`splitHudCamera`).
- Movement by tap follows `route` one tile middle at a time; the last bit of a step is taken in one
  go, so a long frame never overshoots and oscillates.
- Touch (`pointer.wasTouch`, not the mouse) goes through `stick`: a touch on the world records its
  view and world point; dragged past `STICK.drag` it goes `live` and steers as a floating stick
  (the base is dragged along past `STICK.r`, `moveInput` returns its direction after the keys,
  snapped to an axis within `STICK.snap` so a block can be pushed), lifted before that it calls
  `tapWorld` like a click. A lift outside the canvas (`pointerupoutside`) ends it too, and a pause
  (the scene's `PAUSE` event) drops it, since a paused scene never hears the finger lift.
  `addPointer(1)` lets a second finger press the buttons. The HUD draws it with `drawStick`.

### Save

`bramblecrest-save` in localStorage: the whole `GameState` (map, position, facing, spawn, hearts,
items, keys, moonstones, flags, quest, falls, foes beaten, the trials' best times in ms). A trial
under way is not saved. It is written on a map change, on a
chest, cut thorns, a key door unlocked, a plate, broken rock, the bells, a moonstone, a quest step
and each boss, all through `GameScene.persist`, which holds a save asked for while the hookvine
pulls the knight (a bellseed bursting, a moonstone picked up) until they land on the post, so a
reload never puts them or their spawn over water or a pit. Flags in use: `chest-<id>`, `door-<id>`, `gate-cut`, `woods-thorns`, `plate`,
`boss`, `foe-<i>`, `belfry-foe-<i>`, `broke-<map>-<x>-<y>`, `bells`, `wraith`, `cat-1` to `cat-3`,
plus the flags of hidden places. `load` fills in fields a save from an older version lacks
(`items.seeds`, `seeds`, `trials`), and starts over when the saved `map` or `spawn` is not a map (`isMapId`)
or a position is not a number. Cutting the gate before bringing the blade back is fine: the
elder's `quest-thorns` then moves the quest straight on to `shrine`.

### Hub settings

- Difficulty: `START_HEARTS` (5, 3, 2) in `state.ts` and `SUMMON_MS` in `foes.ts` (both bosses).
- Reduce motion: no screen shake, light flashes, foe hit flash, roll spin, bell swing, boss pulse
  or bobbing (the walk, the wisp, moonstones, the wraith); the knight's hurt blink and a
  bellseed's last flicker hold still.

## Testing hooks

- `window.game.scene.getScene('Game')` gives `state` (the `GameState`), `dialog` (`{ speaker,
  lines, i }` or null), `route` (the steps left of a tap's walk, or null), `target`, `foes` and
  `boss`, `wraith`, `bombs` and `trial` (`{ map, ms }` or null); `spot('npc' | 'chest', id)` is where to tap a person or chest in the world and
  `screenOf(x, y)` turns a world point into view pixels (allowing for the camera's zoom).
- `e2e/playthrough.spec.ts` taps the elder, taps through her lines, taps the `blade` chest, taps
  the elder again, walks to the street below the gate (`STREET`) and taps the gate's thorns
  (`GATE`). Mirrored there, so change them together: the elder's, the chest's and the gate's
  places, `START_HP` (Normal's three hearts), the quest stage names, the `chest-blade` and
  `gate-cut` flags, the speaker name `Elder Wren`, the item text naming the Old Blade and the save
  key. It runs in British English, the default language, so those are the `elderName` and `foundSword` texts of `i18n/en.ts`. It checks that the view point it taps is on screen and below the HUD's top 70 pixels.
- It saves `0-start`, `1-elder`, `2-blade` and `3-gate` screenshots.

## Making common changes

- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and a US spelling in `i18n/en-US.ts` if it differs (colour, centre); run
  `node scripts/check-translations.mjs`. German runs longer: the dialog box wraps, but toasts, the
  journal line and the end card's buttons don't, so check a new text with `?lang=de`.
- **Add a person**: an `npcs` entry in the map (name via `t`), a sprite in `paint.ts` (keyed by id),
  and lines in `talk.ts` (each a key in the `i18n/` files).
- **Add a chest or item**: a `chests` entry with an `ItemId`; a new item needs its text in
  `openChest` (a key in the `i18n/` files) and its effect in `give`.
- **Add a map**: a builder function in `maps.ts`, its id in `MapId`, its theme's colours in
  `ground.ts`, and exits both ways (an exit lands on the far side's tile and facing).
- **Add a foe**: its kind in `EnemyKind`, its row in `FOES`, its sprite, and its behaviour in
  `updateFoes`.
- **Add rock to break**: a `boulder` tile (outdoors, a sprite like a bush) or a `crack` tile (a
  dungeon wall, painted in `ground.ts`). Nothing else is needed: the burst and the saved flag
  handle it.
- **Add a chapter**: new stages at the end of `QUESTS` with their `OBJECTIVES` (text keys), lines in `talk.ts`
  that move them on, and a `chapterEnd` case; raise `MOONSTONES` with the new stones.
- **Hookvine posts** only catch along the knight's row or column, so pairs across a gap must share
  a row (or column).
- **Retune**: `src/scenes/layout.ts` (speeds, reaches, the lantern), `foes.ts` (foes and the boss)
  and `state.ts` (hearts).

## Gotchas

- Phaser 4 has no `setTintFill`: flash with `setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)`
  and clear with `clearTint().setTintMode(Phaser.TintModes.MULTIPLY)`.
- Don't name scene fields `time` or `lights`: they clash with `Phaser.Scene`'s own (`now` and
  `glows` are used instead).
- Beaten foes stay in `foes` with `alive` false and a destroyed sprite until the end of
  `updateFoes`, which filters them out; skip them in anything that touches the sprite within a frame.
- The camera has no size until its first frame, so the night skips drawing until it does.
- Never use a red cross in any art (root AGENTS.md).
