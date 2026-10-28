# Hotfoot: guide for agents

How this game is built and where it stands, for agents about to change it. `README.md` covers how
to play, the boon table and the controls. Per the root `AGENTS.md`, keep this file up to date in
the same PR as any change to the game.

## Current state

An endless auto-runner: a knight runs right at a fixed screen x while the course scrolls, and the
player jumps spikes, pits, fire vents and goblins and up onto raised ledges, slides under hanging
blades and bats, and picks up coins. Every 3200 px (100 m) a checkpoint stops the run on a choice
of two boons, and each stage after runs faster with obstacles closer together and new kinds mixed
in.

- Implemented: the run (jump, Second Leap air jump, slide, air drop into a slide), four static trap
  kinds (spikes, pit, blade, timed fire vent), two moving foes (a goblin pacing its beat, a bat
  flying at the knight) that can be stomped from above, raised ledges and two-step stairs the knight
  climbs and drops off, hearts with a hurt blink, coins with lodestone pull, checkpoints with two
  boon cards, eight boons plus the Field Dressing filler, a game-over panel with a coin shop and
  "Run again", a fading controls hint on stage 1, round Slide and Jump buttons on touch screens, and progress saved between runs (best distance,
  banked coins and a bought boon).
- Languages: every text on screen and How to play follow the hub's Language setting: British
  English, US English and German (`src/i18n/`).
- Loop extras: a **coin streak** (every 10 coins taken in a row without a hit raise a multiplier, up
  to x5, shown in a HUD chip, with "+N" pops and a trail of gold stars; any hit resets it), a
  **wayside shrine** once a stage from stage 2 (slide into it to trade 15 run coins for a heart when
  hurt) and a **run track** under the HUD (a banner every 100 m, the knight's marker, and a ghost
  flag at the best distance).
- Gameplay upgrades: **terrains** (each stage after the first runs on its own ground with its own
  rule: the Frozen Pass, where slides run 60% longer and each landing skids for 220 ms so a jump
  waits it out, the Fen, where jumps are 20% lower, and the Windy Pass, where the knight runs at
  70% speed in the air; stages go road, ice, fen, wind, Gatekeeper, fen, wind, ice and so on; each
  opens with a title and shows its name in a tag right of the run track, with snow or gusts drawn
  over it), the **Gatekeeper** on every fifth stage (an ogre boss who keeps ahead throwing barrels
  to jump and axes to slide under, then tires and stands to be stomped; three stomps beat it for 25
  coins and the run goes on to a checkpoint 1400 px later), the **armoury** on the game-over panel
  (banked coins forge lasting upgrades: Iron Heart, Lodestone Charm, Squire's Purse), **cursed
  boons** (Cursed Gold, Glass Greaves, Iron Oath: from the second checkpoint one may take the
  second card, half the time; they trade something away and are never for sale) and the **daily
  course** (a "Daily course" button on the game-over panel starts a run whose course and boons are
  drawn from a seed of the date, with its own best distance; it starts bare, without the armoury or
  a bought boon, so everyone runs it alike).
- Round 2 upgrades: **forked roads** (from the checkpoint before stage 3, once the boon is taken,
  two road cards pick the next ordinary stage's road: the High Road has more coins, an extra goblin
  and bat in the pool, gaps 40 px tighter, no shrine and a streak cap of x7; the Low Road has gaps
  40 px wider and the shrine), **boon pairs** (`pairs.ts`: Winged Boots + Second Leap is Falcon's
  Glide, half gravity while falling; Golden Greed + Lodestone is Goblin's Hoard, two more pulled
  coins per stomp; Aegis + Shadow Cloak is Bulwark, a blocked hit removes the foes and missiles
  within 220 px ahead; hinted on the cards, announced with a pop when completed), **the herald's
  dare** (from stage 2 each ordinary stage has one, by stage in turn: stomp 2 foes, take no hit,
  take 20 coins, reach a x3 streak; met, it pays 20 coins at once and the stage's checkpoint deals
  three cards; shown in a strip under the tag and in the stage title), **the rockfall** (every
  seventh non-boss stage: boulders 240 px behind the knight that keep their pace, creep 10 px/s and
  gain 90 px per hit and 45 px per skid; catching the knight costs a heart and resets it) and **the
  Dragon's Keep** (the first stage starting at or past 1500 m is a boss stage with the dragon,
  which throws fire on the road and tail lashes at head height; three stomps beat it for 60 coins
  and the lasting crown, saved and drawn on the knight's helm; the run then goes on 60 px/s faster
  with gaps 50 px tighter).
- The art is an illuminated manuscript: a gothic miniature on vellum, painted on 2D canvases
  (`src/art/ink.ts`): a lapis-and-madder diapered sky with a gold-leaf moon, crags and a pink
  castle, lollipop trees, a turf road, ink outlines with white highlights, gold-leaf coins, a lapis
  HUD band with an illuminated initial on the stage's name, and a vellum margin of acanthus
  scrollwork under the road with a rubric caption that names what is ahead. No cast shadows.
- One scene does everything: there is no title screen, pause, settings or menu of its own (the
  shared start and pause screens cover it). The run starts as soon as `GameScene` loads. Sound
  effects and a galloping chiptune song play throughout (see Sound). The hub's shared settings (difficulty, frame cap, FPS readout, reduced motion and full screen) apply; see Hub settings below.
- Coins are counted during a run and banked when the knight falls. On the game-over panel they buy
  the boon missed at the last checkpoint (a card not taken, a sellable one first), for `BOON_PRICE` (30) coins. The next
  ordinary run starts with that boon at one rank, with full hearts (a daily run keeps it waiting).
  The Squire's Purse's starting coins (`purse`) are never banked: a fall banks `coins - purse`. One purchase at a time; Field Dressing
  and cursed boons are never for sale, and no boon is for sale before the first checkpoint. The
  "Armoury" button opens a panel over the game-over panel where the bank also buys armoury levels.
- The best distance, the banked coins, a bought boon, the armoury's levels and the last daily
  course's best persist. A run in progress is lost on
  reload; a bought boon waits in storage until a run starts with it.
- No TODOs or FIXMEs in the code.

## Architecture

### File map

- `src/howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English, US English (the same with "Armory", made by `us`) and German, picked with `byLanguage`
  and handed to `setupGame(game, { howToPlay })` in `src/main.ts`; update every language when the
  controls or the first round change.
- `src/i18n.ts` and `src/i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British
  English source, `i18n/de.ts` the German (with `keepEnglish` for the texts that stay the same) and
  `i18n/en-US.ts` only "Armory" and "The Armory". `t(key, vars)` shows a text in the hub's language; `TextKey` types
  the keys. Every text on screen goes through `t`, and the catalogues (`BOONS`, `PAIRS`,
  `ARMOURY`, `BOSS`, `ROADS`, `TERRAIN`, `DARE_TEXT`) and the sim's word effects name their texts
  by key, never by English words. Numbers come out formatted for the language (2,000 m or
  2.000 m), and the daily course's date through `formatDate`.
- `src/audio/sound.ts`: the sound table `sfx` (`sounds` from `shared/audio.ts`) and the `SONG`
  with its parts (see Sound). `src/audio/cues.ts`: `SoundCues`, which plays them from what changed
  in the run each frame.
- `src/trophies/`: the game's ten trophies (`shared/trophies.ts`). `index.ts` lists them
  (`trophies`: id, tier, icon, `hidden` for Dragonslayer) with their texts in `trophies/i18n/`
  (`en.ts`, `de.ts` and `en-US.ts` for "armory": the name keyed by the id, what earns it by
  `<id>Text`), and imports nothing else from the game, since the hub loads it for its trophy shelf.
  `main.ts` hands `trophies` to `setupGame`, which lists them on the start and pause screens.
  `check.ts` holds each trophy's condition on the `GameState` (`EARNED`: the first checkpoint,
  `STOMPS` 10 stomps in a run, a shrine used, a x5 streak, a boon pair, a dare met, a Gatekeeper
  beaten, `DISTANCE` 1,000 m in a run, every armoury item full, the dragon beaten) and
  `checkTrophies(state)`, which `GameScene.update` calls every frame after `tick`. A new trophy is an
  entry in `index.ts`, its two texts in each language file and its condition in `EARNED`.
- `src/main.ts`: creates the `Phaser.Game` (designed at 960x540, `Scale.FIT`, `pixelArt: false`) with `BootScene`
  then `GameScene`, calls `setupGame(game)` and `setupScaling(game, { fill: true })` (see Screen scaling), and puts
  `game` on `window` in dev builds.
- `src/game/state.ts`: `GameState` and its parts (`Trap`, `Ledge`, `Shrine`, `Boss` with its
  `BossKind`, `Rockfall`, `Dare`, `Coin`, `Effect`, `Runner`), the terrains (`Terrain`, `TERRAIN`
  names and rules as `TextKey`s, `ICE`, `MARSH`, `WIND`, `terrainOf`), the roads (`Road`, `ROADS`:
  name, short name for the tag, card text, the card's kind line and the stage title's line, all
  `TextKey`s; `ROAD` (first stage, streak and gap changes), `streakMax`), the dares (`DareKind`, `DARE`
  (first stage, reward, kinds in turn, goals), `dareOf`, `DARE_TEXT` (each kind's text key, filled
  in with the goal as `n`)), the rockfall (`ROCK`,
  `isRockStage`), `DRAGON_AT` and `HARDER` (the run after the dragon), `BOSS_EVERY` and
  `isBossStage`, the daily course's randomness (`rand`, `seedOf`, `today`), the physics and size
  constants, `BOON_PRICE`, `STREAK` and `streakMult` (the coin multiplier, capped by the road),
  `SHRINE` (first stage, price, width), `FOES`, `TRAP_SPAN`, `FLAMES` and `flameOf` (a vent's
  burn), `AWAKE`, `floorAt` (ground height under a stretch of course), `speedOf`, `stats` (the
  knight's numbers from boon ranks, the armoury, the terrain and the pairs' bonuses `glide`,
  `hoard`, `bulwark`), `canTake`, `freshState`, `metres`, and `trackOf` (the run track's numbers:
  metres run, best, track length, banners, metres to the next banner).
- `src/game/sim.ts`: the rules. `newRun` (from a `Carry`: best, bank, pending boon, armoury,
  crown; and a daily date or null), `jump`, `slide`, `tick`, `rollChoices`, `pick`, `pickRoad`,
  `buyMissed`, `buyArmoury`, plus `runnerBox` and the private helpers: collision (`touches`), foe
  movement (`moveFoes`), stomping (`stomp`, with the hoard's coins), a boss's stomps and bumps
  (`bossContact`, which also crowns the knight), coins (`gainCoin`: the streak and its multiplier),
  the dare's progress and reward (`dared`, `meetDare`), shrines (`visitShrines`) and damage
  (`hurt`, which also takes `'wall'` for a ledge's side, `'boss'` and `'rock'`, resets the streak,
  loses a no-hit dare and, with Bulwark, knocks foes away on a block).
- `src/game/boss.ts`: both bosses' numbers (`BOSS` by `BossKind`, each with its name as a
  `TextKey` and its `missiles`),
  `bossOf`, `MISSILES` (the thrown trap kinds), `moveBoss` (its modes and throws) and `bossStands`.
- `src/game/pairs.ts`: the `PAIRS` table (`PairId`, name, the two boons, text, and the `pop` words
  shown when the pair is made, all `TextKey`s but the boons), `pairsOf` (the
  pairs completed by a run's ranks) and `pairFor` (a boon's pair and partner, for the card hint).
- `src/game/armoury.ts`: the `ARMOURY` table (name and text as `TextKey`s, price per level), `ARMOURY_EACH` (what a
  level adds), `noArmoury` and `nextPrice`.
- `src/game/course.ts`: `buildStage` lays out a stage's pieces (`Piece`: each trap kind, `ledge`
  and `steps`) and their coins (more on the High Road), from `SHRINE.from` its shrine
  (`placeShrine`, in the gap between pieces nearest the stage's middle; none on the High Road), from
  `DARE.from` its dare and on a rockfall stage its rockfall; `planOf` sizes and places one piece,
  `piecesOf` is the pool per stage and road, `OPENING` is stage 1's fixed first four, `gapsOf` gives
  spacing per stage, road and the run after the dragon, `dragonStage` says whether a stage is the
  dragon's, `buildBossStage` lays out a boss's stage (the road terrain, no road), `nextStage` moves
  to the next stage (and sets its speed and terrain), and `roadChoiceDue` says whether a checkpoint
  asks for a road (the next stage is ordinary and at least `ROAD.from`).
- `src/game/boons.ts`: the `BOONS` table (name and text as `TextKey`s, `maxRank`, `filler`,
  `cursed`), `BOON_IDS`,
  `forSale` and `CURSE` (from which stage, how often).
- `src/game/save.ts`: `loadProgress` and `saveProgress` (best distance, banked coins, the bought
  boon, the armoury, the daily best, the crown).
- `src/scenes/BootScene.ts`: fits the layout to the view (`fitLayout(viewSize)`), bakes every texture, then starts `Game`.
- `src/scenes/GameScene.ts`: owns the `GameState`, wires input, ticks the sim and draws everything.
- `src/scenes/layout.ts`: screen constants, laid out for the designed view (`DESIGN`, `DESIGN_GROUND_Y`) and
  moved to the view the game runs in by `fitLayout` (see Screen scaling): `VIEW`, `GROUND_Y`, `RUNNER_X`, `TAP_SPLIT_Y`,
  `HUD_SHIFT` (how far the HUD's middle and right-hand items moved),
  `FRAME` (the miniature's gold frame), `TRACK` (the run track), `TAG` (the stage's tag),
  `DARE_TAG` (the dare's strip under it), `STAGE_TITLE`, `ARMOURY_PANEL`, `STREAK_CHIP`, `MARGIN`
  (the scrollwork and caption), `CARDS` (card size and the centres for one, two or three cards),
  `BUTTON`, `ACTION_BUTTONS` (the touch Slide and Jump buttons), `HUD_HEIGHT`, `UI_DEPTH`, `FONT` (a Georgia serif stack)).
- `src/ui/BoonCards.ts`: the checkpoint overlay and its vellum cards: two or three boon cards (a
  cursed boon's card is edged in madder; a paired boon's card carries the pair's hint), then the
  two road cards; exposes `cards: CardSpot[]` (`id` is a `BoonId` or a `Road`).
- `src/ui/Button.ts`: `makeButton`, the lapis button ruled in gold used on the game-over panel and
  the armoury (its caption is the container's second child).
- `src/art/ink.ts`: the manuscript toolkit. `C` (the pigments as CSS colours) and `N` (the same as
  numbers for Phaser), `SERIF`, `seeded`, `paint` (paints a canvas at `sharpRes` and adds it with
  `textures.addCanvas`, marked with that resolution), `tileAt` (scrolls a tile sprite of a painted
  texture in shown pixels), `poly`, `circle`, `oval`, `hl` (a white highlight), `gold` (a gold-leaf
  gradient), `star6`, `heartPath`, `bezant` (a gold coin) and `shade`.
- `src/art/scenery.ts`: the vellum `page` (stains, acanthus scrollwork, snail), `sky` (diaper,
  sunset clouds, stars, moon), `far` (crags and a castle), `near` (trees and a tower), the road
  strips `ground`, `ground-ice`, `ground-marsh` and `ground-wind` (`GROUNDS`), spikes, pits, the hanging log (`blade`), fire vent, `ledge` (pink ashlar),
  coins, `checkpoint`, `shrine` and `shrine-used`, the shrine's `banderole` and the miniature's
  `frame`. Exports `FAR_H`, `NEAR_H`, `GROUND_TOP` and `PIT_DEPTH`.
- `src/art/foes.ts`: the goblin (`goblin-0`, `goblin-1`, sized by `GOBLIN_ART`), bat (`bat-0`,
  `bat-1`, `BAT_ART`), the Gatekeeper (`gate-ready`, `gate-throw`, `gate-tired`, `GATE_ART`) and
  the dragon (`dragon-ready`, `dragon-breathe`, `dragon-tired`, `DRAGON_ART`; `BOSS_ART` maps a
  `BossKind` to its art), facing left, their thrown `barrel`, `axe`, `fire-0`/`fire-1` and `tail`,
  and the rockfall's `boulder`.
- `src/art/knight.ts`: the knight's poses (`KnightPose`), painted as `knight-<pose>`, and
  `KNIGHT_FEET` (texture sizes and where the feet are).
- `src/art/icons.ts`: one 64x64 icon per boon (`iconTexture`), per road (`roadIcon`), the
  armoury's (`armouryIcon`: the purse's own, Iron Heart and Lodestone Charm reuse Hearty Ale's and
  Lodestone's), and the HUD's `heart-full` and `heart-empty`.
- `src/art/hud.ts`: `bakeHud` (the `hud-band`, the illuminated `initial` (the first letter of
  "Stage", `stageInitial`: S, or E for German "Etappe"; the HUD writes the rest, `stageRest`), the `streak-chip` and its
  `medallion`, the `track-strip`, the `tag-strip` and `dare-strip`), `bakePanel` (vellum panels:
  cards, the title strip, the game-over panel), `bakeButton` and `bakeActionButtons` (the touch
  Slide and Jump discs, called from `bakeHud`).
- `shared/setupGame.ts` and `shared/settings.ts` (outside the game folder): the hub's settings.
  `main.ts` imports `setupGame`; `state.ts` imports `byDifficulty`. `shared/scaling.ts`:
  `main.ts` imports `setupScaling`, `ink.ts` imports `sharpRes`, `GameScene` imports `viewPoint`.
  `shared/i18n.ts`: `i18n.ts` imports `translator`, `howToPlay.ts` `byLanguage`, the `i18n/`
  files `Translation`, and `GameScene` `formatDate`.

### How it runs

- Boot: `BootScene.create` calls `bakeScenery`, `bakeFoes`, `bakeKnight`, `bakeIcons` and
  `bakeHud`, which paint 2D canvases (`ink.ts`) and add them as textures. There are no asset files.
  A texture shows as big as it appears on screen (its canvas has more pixels on a big screen; see
  Screen scaling); most art is written in page units (twice screen size,
  the mockup's scale) under `ctx.scale(0.5)`, the knight at 0.5 and the foes at 0.46 and 0.45.
- Tick: `GameScene.update(time)` computes `dt` from the frame timestamp (not Phaser's smoothed
  delta), clamped to `MAX_STEP_MS` (100), with 0 on the first frame. It calls `tick(state, dt)`
  once per frame (no fixed substeps) and advances its own `clock`, used only for animation.
- `tick` order: age effects; stop unless `phase === 'running'`; add `dt` to `time`; move awake
  foes (`moveFoes`); while a boss stands, push `checkpointX` to at least its `holdBack` ahead;
  move `distance` (at `WIND.air` of the speed when airborne on wind; clamped to `checkpointX`) and
  the rockfall with it (plus `ROCK.creep`); move the boss (`moveBoss`); if the feet are now below
  the floor (`floorAt` under the knight's box), that is a ledge's side: hurt (`'wall'`, unless
  unhurtable or less than `STEP_UP` short) and snap onto its top; apply gravity (halved while
  falling with Falcon's Glide) and land on the floor (on ice, a landing starts a skid, and the
  rockfall gains `ROCK.skid`); stomp a foe landed on; stomp or bump the boss (`bossContact`);
  refill jumps when grounded; count down slide, hurt and skid (a jump queued during the skid fires
  as it ends, in the air too if the knight walked off a ledge meanwhile); check one trap hit (a pit
  even while unhurtable: the fall and the throw-out happen, marked by a `fall` puff, but cost nothing); let the rockfall gain `ROCK.hit` if a hit landed this tick, and
  if it has reached the knight's back, hurt (`'rock'`) and drop it `ROCK.start` behind (a knight
  still unhurtable is only kept at their heels); visit a shrine slid into; collect or pull coins;
  drop traps, ledges, shrines, coins and a beaten boss more than `BEHIND` behind; enter
  `checkpoint`, note its banner, meet a no-hit dare still standing, roll choices and clear
  the runner's slide, skid and queued jump and drop when `distance` reaches `checkpointX`.
- A boss (`moveBoss`, `Boss.mode`, with the numbers `bossOf(boss)` from `BOSS[kind]`): `wait` on
  the road until `station` ahead of the knight; `throw` keeps that gap and throws `throws(hp)`
  things (its two `missiles` by turns: barrel, axe, barrel... or fire, tail, fire...) every
  `throwEvery(hp)` ms, faster as it loses hp; `tired` first keeps the gap (`ms > 0`) until its last
  throw is past and the knight is on the road, then stands (`ms` 0); a stomp (falling onto its `h`:
  86 px for the Gatekeeper, 96 for the dragon) costs it an hp and sends it to `flee` (running `flee`
  faster than the knight until back at its gap, then `throw` again); running into it hurts the
  knight and also sends it to `flee`; leaping clean over it does too. No contact while it waits or
  flees. At 0 hp it is `down`: `reward` coins are paid and `checkpointX` is set `after` ahead; the
  Gatekeeper adds to `bosses`, the dragon sets `dragonBeaten` and `crown` and raises `speed` by
  `HARDER.speed` at once.
- Coins: `gainCoin` pays `stats().coinValue * streakMult(streak, streakMax(road))` (the
  multiplier reached before this coin), then adds one to `streak`, pushes a `pop` effect ("+N")
  when the coin is worth more than one, and moves a coin or streak dare on. Picked-up coins and
  stomped foes both go through it (a stomp with Goblin's Hoard also adds `HOARD` pulled coins).
  `hurt` sets `streak` to 0 on every hit, blocked ones included.
- Dares (`dared`, `meetDare`): a stomp, a coin or a streak multiplier reached moves the stage's
  dare on; at its goal it is `done`, `DARE.reward` is paid and a pop says so. A no-hit dare is
  `failed` by any hit and met at the checkpoint otherwise. `rollChoices` deals three cards when
  `dare.done`. It pads with at most one Field Dressing, so once every other boon is at its max rank
  it deals fewer cards (`CARDS.xs` has a one-card centre too); the shop then shows `shopNoneLeft`.
- Roads: `pick` takes the boon and, when `roadChoiceDue`, sets `roads` and stays in `checkpoint`;
  `pickRoad` sets `road` and starts the next stage. `buildStage` reads `road` for the pool, the
  gaps, the coins and the shrine; `buildBossStage` clears it. Nothing else changes by road but the
  streak cap (`streakMax`).
- Shrines: `visitShrines` runs while sliding on the road; a shrine the knight's box overlaps that is
  neither `used` nor `tried` trades `SHRINE.price` coins for a heart (`used`, a `heal` effect) when
  `hearts < maxHearts` and `coins >= price`, and otherwise is marked `tried` with a `refuse` effect
  ("Hearts full" or "Needs 15 coins").
- Moving the knight forward before gravity is deliberate: a jump that is still above a ledge's top
  as it reaches the side lands on it, even if a long frame takes the feet below the top.
- Input: a `pointerdown` on the scene with nothing interactive under it calls `jump` when
  `viewPoint(pointer).y` is above `TAP_SPLIT_Y` and `slide` below it. Keys: Space, Up, W jump; Down, S slide.
  A key's auto-repeat (`event.repeat`) is ignored, so holding Space never fires the Second Leap and
  holding Down never keeps the slide going. On the scene's `RESUME` (the shared pause and Start let
  go) `lastFrame` is cleared, so the first frame back is a 0 ms step rather than a 100 ms catch-up.
  On a touch screen (`device.input.touch`, or once a pointer `wasTouch`) `createActionButtons`
  shows two round buttons in the margin's bottom right (`ACTION_BUTTONS`: Slide at 780, Jump at
  890, y 490, radius 40; textures `action-slide`/`action-jump` and their madder `-down` press,
  baked by `bakeActionButtons` in `hud.ts`) while `phase === 'running'`; they call `slide` and
  `jump` on `pointerdown`, and the scene has a second touch pointer so a thumb on each works. Card and button taps
  are ignored by that handler because they hit interactive objects; the full-screen dims behind the
  cards and the game-over panel are interactive too, so they swallow stray taps.
- Rendering, back to front: the vellum `page` (depth -10, with the margin's scrollwork), the `sky`
  inside the frame, the `far` and `near` tile sprites (scrolling at 0.15 and 0.4), the `ground` tile
  sprite (depth 1), ledges, ledge ends and doors (`Graphics`), pits, the shrine and checkpoint
  (depth 3), traps, foes and coins (depth 4), the shrine's banderole (4.2), the `frame` overlay
  (4.5: vellum side strips and the gold rule), the knight (5), effects (6) and words (6.5), the hint
  and the HUD (`UI_DEPTH`). The margin caption is a `Text` at depth 0, set by `drawCaption` from
  the phase and the nearest thing ahead. It is centred at `MARGIN.captionX` (458) and shrunk to at
  most `MARGIN.captionW` (540) wide, so it stays clear of the shared corner buttons in the bottom
  left (up to about 165 game px in on a small phone) and of the touch Slide and Jump buttons.
- Terrain: `drawWorld` swaps the `ground` tile sprite's texture by `state.terrain`, `drawWeather`
  draws snow (ice) or gust streaks (wind) on a `Graphics` at depth 4.4, under the frame, and
  `drawHud` fills the stage's tag (ground, "Rockfall!" and road) and the dare's strip, and fades
  the stage title (`createTitle`; its rule text takes several lines: the ground's rule, the road,
  the rockfall and the dare) over its first `LEAD_IN` px. A boss is one image (depth 3.5) posed by
  `drawBoss` (`<kind>-ready`, `-throw`/`-breathe`, `-tired`, with its origin from `BOSS_ART`; a
  fallen dragon tilts a little, a fallen Gatekeeper lies flat); barrels roll, axes spin, fire
  flickers and tail lashes whip in `drawTrap`. The rockfall is four `boulder` images (depth 4.3,
  `BOULDERS`: a scale and a distance behind the leading edge each) placed by `drawRocks`, turning
  as they roll, with dust drawn on the effects layer. The crown is drawn on the effects layer over
  the knight's helm while `crown` is set.
- Traps, coins and shrines are diffed into caches each frame (created on first sight, destroyed when
  gone from state), and ledges into `Map<id, TileSprite>` of the `ledge` texture cropped to each
  ledge's height. `drawTrap` animates fire vents (by `flameOf`), goblin steps (by x, flipped when
  walking right) and bat flaps (with a bob that is only drawn, not collided). Effects, the Aegis
  nimbus, the sparkle trail and the HUD's bars and track are `Graphics` cleared and redrawn every
  frame; `pop`, `heal` and `refuse` effects are `Text` objects in `words`, keyed by effect id. The
  sparkle trail (`trail`) is a short list of course points the knight passed, laid every 45 ms of
  the scene's clock while the multiplier is x2 or more. The knight is one image whose texture and
  origin change by pose. `BoonCards.show` rebuilds only when the choices change.
- Saving (`persist`) happens in `update` whenever the phase changes away from `running` (checkpoint
  or fall), on each run's start (`create` and `restart`) and when a boon or armoury level is
  bought. `GameScene` keeps the loaded `Progress`; `persist` copies the run's bank, pending boon and
  armoury into it, and its best into `progress.best` or, on a daily run, `progress.daily`.
  `freshRun(daily)` builds the next run from it, chasing the daily best when the date matches.

### State model

- `GameState.phase` is `'running' | 'checkpoint' | 'over'`. Nothing moves outside `running`;
  `jump`, `slide` return false and `pick` and `pickRoad` need `checkpoint`. A checkpoint holds
  `choices` first and, once the boon is taken and a road is due, `roads` instead.
  A fall (`hurt` setting `over`) ends that `tick` at once: nothing is stomped, touched or picked
  up after it, so the banked coins match the game-over line.
- Coordinates: x is course pixels, left to right; `distance` is the middle of the knight's box.
  Heights (`runner.h`, coin `h`, trap and ledge `h`) are pixels up from the road, and
  `TRAP_SPAN` is up from the trap's own `h`. On a ledge the knight's feet are at the ledge's `h`;
  "grounded" means feet at `floorAt` under the box and not rising. Screen x is
  `RUNNER_X + x - distance` (`GameScene.sx`), screen y is `GROUND_Y - h`.
- `Runner`: `h`, `vh`, `slideMs`, `slideQueued` (slide on landing after an air drop), `jumps` left,
  `hurtMs` (invulnerable time), `skidMs` and `jumpQueued` (the ice skid).
- `terrain` is `terrainOf(stage)`, set by `freshState` and `nextStage` (`'road'` on any boss
  stage). `road` is the stage's road (null on stages 1 and 2 and boss stages) and `roads` the two
  on offer. `dare` is the stage's dare (null on stage 1 and boss stages), `rockfall` its rockfall
  (null elsewhere). `boss` is the Gatekeeper or the dragon on its stage (null otherwise, and once
  beaten and left behind); `bosses` counts Gatekeepers beaten, `dragonBeaten` says the dragon is
  (the run is then harder: `speedOf(stage, true)`, `gapsOf(..., true)`) and `crown` is the lasting
  crown, carried in from the save and set by the dragon's fall. `banners` lists the metres of
  each checkpoint passed, for the run track. `armoury` holds the levels bought; `daily` is the
  daily course's date (null on an ordinary run) and `seed` its random state.
- `traps: Trap[]`: `kind`, `x`, `w`, `h` (the ground it stands on; a bat's, an axe's and a tail
  lash's flying height, 34), `vx` (0 unless a foe or a boss's missile: barrel, axe, fire, tail), a
  goblin's beat `from`/`to`, a fire vent's `phase` in its burn.
  Foes (`FOES`: goblin, bat) only move once within `AWAKE` (760 px) ahead of the knight, just off
  screen. A bat is placed so it meets the knight where its piece was laid out, from the stage's
  speed. A stomped foe is removed from `traps` and counted in `stomps`.
- `ledges: Ledge[]` (`x`, `w`, `h`): raised ground. Steps are two touching ledges, 48 then 80 high.
- `time` is ms spent running this run; fire vents burn by it (`FLAMES`: lit 800 of every 1800 ms,
  sputtering for the 300 before).
- `shrines: Shrine[]` (`x`, `w` 46, `used` once it gave a heart, `tried` once slid into without
  one): at most one per stage, on the road, from stage 2.
- `streak`: coins taken in a row since the last hit (stomps count). `streakMult(streak, cap)` is
  `min(cap, 1 + floor(streak / 10))`, with the cap from `streakMax(road)` (5, or 7 on the High Road).
- `course: Coin[]` (the coins; `pulled` once a lodestone catches one). `effects: Effect[]` are
  short visual timers (`coin`, `hit`, `block`, `dust`, `fall`, `skid`, `stomp`, and `pop`, `heal`, `refuse`,
  which carry their words in `text`).
- `ranks` maps `BoonId` to rank taken; `stats(s)` derives every boon effect from it (cursed ones
  and the pairs' bonuses included), with the armoury's levels (none on a daily run) and the terrain's rule, so boons have
  no other state except `shields` (Aegis and Iron Oath charges, reset from `stats` on each `pick`).
- `nextId` hands out ids for traps, ledges, shrines, coins and effects; sprite caches key on them.
- All mutation is in `src/game/` (`sim.ts`, `course.ts`). `GameScene` only calls those functions,
  except `restart`, which replaces `state` with `freshRun(daily)`, and `buy` and `buyArmoury`,
  which call `buyMissed` and `buyArmoury`.
- Progress across runs: `best` (the best distance in metres), `bank` (coins banked from finished
  runs, added in `hurt` when the knight falls, less the run's starting `purse`), `pending` (the boon
  bought at game over, applied and cleared by the next ordinary `newRun`; a daily one carries it on), `crown` and `missed` (a boon offered at the last
  checkpoint and not taken, set by `pick`: the first other one that is `forSale`, else the first other one; null before any checkpoint). `buyMissed` takes `BOON_PRICE` from `bank` into
  `pending`, and refuses unless the run is over, `missed` is `forSale` (not filler or cursed),
  nothing is pending and the bank covers the price. `buyArmoury` takes `nextPrice` from `bank` and
  adds a level, while the run is over and the item is not full.
- Invariants: `distance <= checkpointX`; `choices` is non-null only at a checkpoint and holds one
  to three ids: two, or three after a met dare, less once the boon pool is short (one Field
  Dressing at most; at most one cursed, always the second); `roads` is non-null only
  at a checkpoint once `choices` is null; `hearts` is clamped to `stats().maxHearts` (and at least
  1) on `pick`; a boss's stage has no pieces, ledges, shrine, dare, road or rockfall; a pit only
  hurts when grounded over its middle; one hit per frame, and none while `hurtMs > 0` (the rockfall
  waits at the knight's heels until then) except a pit, which still throws the knight out but takes
  no heart, shield, streak or dare while `hurtMs > 0`; pieces never overlap, so pits, blades and the rest always
  sit on the road (`h` 0) and the checkpoint is always on the road; `rockfall.x` never passes the
  knight's back.

### Persistence

`localStorage` keys: `hotfoot-best` (the best distance in metres), `hotfoot-bank` (banked coins),
`hotfoot-start` (the boon bought for the next run; removed once a run starts with it),
`hotfoot-armoury` (JSON levels per armoury item, clamped to each item's levels on load) and
`hotfoot-daily` (JSON `{ date, best }` of the last daily course run; a new date starts from 0) and
`hotfoot-crown` (`'1'` once the dragon has been beaten; never removed). Read once in
`GameScene.create` via `loadProgress`, written by `saveProgress`; every access is wrapped in
try/catch. `hotfoot-trophies` holds the trophies earned (`shared/trophies.ts`, each id with the time). Nothing
else is saved by the game; the hub's settings live under the shared `hub-settings`
key (see Hub settings).

### Randomness and timing

- Every random draw goes through `rand(s)` in `state.ts`: `Math.random` on an ordinary run, and a
  mulberry32 sequence on a daily run, so everyone's daily course and boon offers match. On a daily
  run `buildStage` reseeds it with `seedOf(`${date}:${stage}`)` and `rollChoices` with
  `seedOf(`${date}:cards:${stage}`)`, so a stage's layout depends only on the date, the stage and
  the road (and `dragonBeaten`), never on how many draws the cards before it took (a third draw
  after a met dare, or a curse draw) or on an earlier stage. It is used only in
  `src/game/course.ts` (sizes and fire vent phases in `planOf`, ledge heights, `pickOf`, gap
  length) and in `rollChoices` in `src/game/sim.ts`. `placeShrine`, the bosses, the terrains, the
  roads' extra coins, the dare (`dareOf` goes round by stage) and the rockfall take no draws, and
  the curse draw only happens from `CURSE.from` (stage 2). A met dare adds a third draw to
  `rollChoices`, from the second checkpoint on. The art
  uses `seeded()` from `ink.ts`, not `Math.random`.
- Time comes only from the `time` argument of `GameScene.update` (the sim's `state.time` is the sum
  of the `dt`s it was given). No timers, tweens or `Date.now`. The one use of the calendar is
  `today()`, read when "Daily course" is tapped, to pick the day's seed.

### Data tables

- `src/game/state.ts`: `RUNNER` box, `GRAVITY`, `JUMP_V`, `DROP_V`, `SLIDE_MS`, `HURT_MS`,
  `START_HEARTS`, `COIN_REACH`, `STAGE_LEN`, `LEAD_IN`, `BOON_PRICE`, `STREAK` (step 10, max 5),
  `ROAD` (from stage 3, +2 streak cap and -40 px gaps on the High Road, +40 px on the Low Road),
  `DARE` (from stage 2, reward 20, kinds and goals), `ROCK` (every 7th stage, start 240, creep 10,
  hit 90, skid 45, radius 40), `DRAGON_AT` (1500 m), `HARDER` (+60 px/s, -50 px gaps), `SHRINE`
  (from stage 2, price 15, width 46), `PX_PER_M`, `speedOf`, `TRAP_SPAN`, `FLAMES`, `AWAKE`,
  `ICE`, `MARSH`, `WIND`, `BOSS_EVERY`, `terrainOf`'s order, and the per-rank boon and armoury
  multipliers inside `stats`.
- `src/game/boss.ts`: `BOSS.gate` and `BOSS.dragon` (name, size, hp, station, flee speed, throws
  and their spacing per hp, the two missiles' kind, size, height and speed, reward, how far on the
  checkpoint comes, `holdBack`).
- `src/game/pairs.ts`: `PAIRS`; and in `src/game/sim.ts` `GLIDE` (0.5 of gravity), `HOARD` (2
  more coins) and `BULWARK_REACH` (220 px).
- `src/game/armoury.ts`: `ARMOURY` (prices per level) and `ARMOURY_EACH`.
- `src/game/course.ts`: `CLEAR_BEFORE_CHECKPOINT`, `gapsOf`, `piecesOf` (the pool and its weights
  per stage: fire vents and bats from stage 2, steps, tall ledges and a second goblin entry from
  stage 3, a third goblin and second bat on the High Road), `OPENING`, `GOBLIN` (width, beat, speed
  per stage), `BAT` (width, height, speed per stage), `LEDGE_H`, sizes and coin patterns per piece
  in `planOf` (two more coins per arc and row on the High Road, and 8 lead-in coins instead of 5),
  and the shrine's gap (at least `SHRINE.w + 160`) in `placeShrine`.
- `src/game/sim.ts`: `PULL_SPEED`, `BEHIND`, `STOMP_REACH`, `STOMP_BOUNCE`, `STEP_UP`.
- `src/game/boons.ts`: names, card text, max ranks, and `CURSE` (from stage 2, half the time).

### Screen scaling

- `setupScaling(game, { fill: true })` gives the canvas `renderScale` canvas pixels per game pixel (up to 4 on a
  4K screen, 2 with the canvas renderer) and zooms the one camera to match, so all layout stays in
  the game pixels of `layout.ts`.
- The game fills every screen shape: the view is 960x540 grown to the screen, 960 to 1296 wide and
  540 to 720 tall, picked once at start. `BootScene` calls `fitLayout(width, height)` with
  `viewSize` before painting, which moves `layout.ts`'s values in place (`GROUND_Y`, `RUNNER_X` and
  `TAP_SPLIT_Y` are live `let` exports): with `dx` more width the knight, the run track, streak
  chip, stage name, stage title, caption and cards move `dx / 2` right and the distance, coins, best,
  tag, dare strip and touch buttons `dx` right (`HUD_SHIFT` for the HUD's literal positions), so the
  hearts keep to the left edge and the rest to the middle and right; with `dy` more height the road
  and everything under it (the frame's bottom, the margin, caption and touch buttons) go `dy` lower
  and the sky grows (cards and the stage title go `dy / 2` lower). The page, sky, frame and HUD band
  are painted as big as the view (`scenery.ts` shifts the sky's clouds, moon and stars and the
  blade's log down by the lift and carries the diaper and chain up); the `far` and `near` layers
  still wrap every 960 px and are just wider tile sprites. Overlays use `VIEW` and centre in it. At
  960x540 `fitLayout` changes nothing, so the playthrough's tap points hold. The camera never scrolls: the course scrolls by moving
  objects and tile positions, so no `scrollingCamera` or `splitHudCamera` is needed.
- `paint` in `ink.ts` paints each texture at `sharpRes(w, h)` canvas pixels per shown pixel, sets
  the texture source's `resolution` to that, and sets the base frame's source size back to `w` x
  `h`, so images, origins, flips and hit areas stay in shown pixels with no change at the call sites.
- Tile sprites (`far`, `near`, `ground`, ledges) repeat in texture pixels, so they are scrolled with
  `tileAt(sprite, x)`, which sets the tile scale to `1 / resolution` and scales the scroll to match.
  A new tile sprite of a painted texture goes through `tileAt` too.
- Read a pointer on the screen with `viewPoint(pointer)` (game pixels), never `pointer.x/y`
  (canvas pixels). Texts are drawn at `renderScale` by the shared module.
- `index.html` has the shared `100dvh` and `touch-action: none` styles. On a phone held upright the
  shared scaling turns the game to fill the screen. `e2e/screens.spec.ts` checks the game on five screens.

### Sound

All sound is made in code by `shared/audio.ts`; nothing plays under browser automation, so the
playthrough is unchanged. The sim (`src/game/`) has no audio: `SoundCues.update(state)` runs in
`GameScene.update` after `tick` and plays from what changed since the last frame (new effects by
id, the runner's jumps and slide, the boss's hp, the rockfall's x, fire vents' burn, the phase and
the stage), at most one sound of each kind a frame, so a row of coins or a volley stays one sound.
`SoundCues.reset` is called when a run starts (`create`, `restart`). Button sounds play in
`GameScene` itself.

- **Song** (`SONG`): 150 BPM in D Mixolydian, a square lead, a pulse counter-melody, a triangle bass
  galloping long-short-short and noise drums. Loops by `partOf(state)`: `road` (the old road, eight
  bars), `ice` (high, sparkling staccato), `fen` (low and murky, half time), `wind` (long airy notes
  over quick arpeggios), `boss` (the Gatekeeper and the dragon while they stand), `rockfall` (the
  road's tune over a driving bass) and `camp` (calm, at a checkpoint and on the game-over panel).
  Stings: `lose` (the knight falls) and `crown` (the dragon beaten).
- **Effects** (`sfx`), and where they play: `jump` (a jump, at 1.35x pitch for an air jump, also the
  skid's queued jump), `slide` (a slide starts), `drop` (an air drop), `land` (the `dust` effect, and the `fall` puff of a pit taken while unhurtable, which plays no `jump`),
  `skid` (the `skid` effect on ice), `coin` (a `coin` effect, climbing the D major scale with the
  streak's count towards the next multiplier), `streak` (the multiplier goes up), `stomp` (a `stomp`
  effect: a foe stomped or knocked away by Bulwark), `hit` / `block` (the `hit` / `block` effect),
  `crackle` / `flare` (a fire vent on screen turning `warn` / `lit`), `heal` (a shrine's heart),
  `dare` (the `dareMetPop` pop), `pair` (a pair's pop), `throw` / `roll` (a new axe or tail lash /
  barrel or fire), `bossHit` (the boss's hp drops), `bossDown` (the `gateBeaten` pop), `rock` (the
  rockfall catches the knight and falls back), `checkpoint` (the phase turns `checkpoint`), `pick`
  (a boon or road taken), `horn` (a new stage starts), `again` (Run again or Daily course). Shared
  sounds: `ui('refuse')` for a shrine's refusal and a refused purchase, `ui('coin')` for a boon or
  armoury level bought, `ui('click')` for Armoury and Back.

### Hub settings

- `src/main.ts` calls `setupGame(game)` from `shared/setupGame.ts` right after creating the game.
  It applies the frame cap, the FPS readout, reduced motion and full screen (camera shake and flash become
  no-ops; Hotfoot uses neither).
- Difficulty scales one number: `START_HEARTS` in `src/game/state.ts` is
  `byDifficulty(5, 3, 2)` (easy, normal, hard), from `shared/settings.ts`. It is read once at
  module load, so a change takes effect on the next page load. It sets the hearts of a new run
  (`freshState`) and the base of `maxHearts` in `stats`.
- `GameScene` reads `settings.reduceMotion` itself: with it on, the knight's hurt blink (alpha
  toggled every 80 ms) is held at a steady 0.6 alpha, the Aegis nimbus's pulse is held at a fixed
  alpha, the "+N" coin pops and the shrine's "+1 heart" stay where they appear instead of rising,
  the streak's sparkle trail is not drawn, the Gatekeeper's flash after a stomp is held at 0.6
  alpha, the snow and wind streaks, the dragon's tail lash bob, the boulders' roll and the
  rockfall's dust are drawn still, the lit fire vents and the dragon's rolling fire keep one frame
  (`flames-lit0`, `fire-0`) instead of flickering, and the bats keep one wing frame with no bob.
- Normal must stay exactly as designed: the playthrough runs on Normal and its `STAGE_1` expects 3
  hearts.
- Keep the README's difficulty line (5 hearts on Easy, 2 on Hard) in sync with `byDifficulty`.
- The settings are stored under the `hub-settings` key by the hub, not in the game's own save, and
  read once when the page loads.

## Testing hooks

- `src/main.ts` sets `window.game` (the `Phaser.Game`) in dev builds only.
- `e2e/playthrough.spec.ts` reads `game.scene.getScene('Game')`: its `state` (JSON-copied) and
  `boonCards.cards` (`CardSpot` with `id`, `x`, `y`, `w`, `h` in game pixels; two boon cards at
  the first checkpoint, since no dare and no road choice come before stage 2).
- It seeds `Math.random`, owns the clock with 64 ms frames, and blocks WebGL so Phaser uses canvas.
- It drives only mouse clicks on the canvas: `JUMP_AT` (720,120) and `SLIDE_AT` (720,470), on
  either side of `TAP_SPLIT_Y`, and the centre of the first boon card. Nothing interactive may sit
  under those two points (the run track and the margin caption are not interactive). The touch
  Slide and Jump buttons stay hidden in the test (no touch screen) and sit clear of `SLIDE_AT`.
- Values the test copies and that must stay in sync: `VIEW` 960x540, `HALF_W` 14 (half of
  `RUNNER.w`), `STAGE_1` (3 hearts, speed 260, `checkpointX` 3200), and the reaction distances in
  `REACT`. Its `obstaclesOf` turns `traps` and the rising sides of `ledges` into one list; it
  slides for blades and bats and jumps everything else, acting only when `runner.vh === 0`
  (grounded). It asserts stage 1 has spikes, a blade, a goblin and a ledge (`OPENING` in
  `course.ts`), a jump peak above 100 px, a slide, a goblin and a ledge's side passed, running on a
  ledge, coins, zero hits, a streak past 10 and coins equal to what that streak pays (`STREAK` and
  `coinsFor` copy the rule: step 10, max x5), no shrine on stage 1 and a new run's streak of 0, two
  different choices matching the card order, that stage 1 runs on the road with no Gatekeeper, and
  that stage 2 is faster, on the Frozen Pass (`terrain: 'ice'`), laid out past 3200 and has one
  unused shrine, and that `hotfoot-trophies` then holds only `checkpoint` (First banner). The terrains past stage 2, the bosses, cursed boons, the roads (from the second
  checkpoint), the dare's reward and third card, the rockfall, the pairs, the armoury and the daily
  course are off its path on purpose; stage 2 carries a stomp dare the test never meets.
- The test loads the game by its folder URL in `page.goto`, which must follow the folder name.

## Making common changes

- Add or change a text: its key in `src/i18n/en.ts`, the German in `src/i18n/de.ts` (the build
  fails without it) and, when the US spelling differs (armoury), the US one in `src/i18n/en-US.ts`;
  run `node scripts/check-translations.mjs`. German runs longer than English: the tightest spots
  are the HUD's best run (`fitBest` shrinks it clear of the coins' label), the stage's tag on a
  daily High Road rockfall stage, the shrine's banderole, the road cards' kind line and the stage
  title's lines, so check a new text with `?lang=de`.

- Add a boon: add the id to `BoonId` and an entry to `BOONS` in `src/game/boons.ts` (its name and
  text in the `i18n/` files); apply its
  effect in `stats` in `src/game/state.ts` (or in `pick` for a one-off effect like heart and mend);
  draw it in `ICONS` in `src/art/icons.ts` (the `Record` type forces this); update the README table.
- Add a trap or foe: add the kind to `TrapKind` and a `TRAP_SPAN` entry (pits are special-cased
  in `touches`; add it to `FOES` if it moves and can be stomped), give it a case in `planOf` and a
  place in `piecesOf` in `course.ts`, bake its art in `src/art/scenery.ts` (or `foes.ts`), and
  create its sprite in `GameScene.drawWorld` (animate it in `drawTrap`). `OPENING` and the test's
  kind checks and jump/slide choice need updating if stage 1 should include it.
- Add terrain: ledges are plain `Ledge` rows, so a new shape is a `planOf` case pushing ledges. Keep
  each ledge long enough to land a jump on at the stage's speed (as `steps` does), and keep
  traps off ledges unless the art and the test handle a trap at `h > 0`.
- Tune difficulty: `speedOf` and `STAGE_LEN` in `state.ts`, `gapsOf` in `course.ts`. Changing
  stage 1's speed, length or Normal hearts means updating `STAGE_1` in the test. To change what
  the hub's Difficulty setting scales, edit the `byDifficulty` call (see Hub settings) and the
  README's difficulty line.
- Move the screen layout: edit `src/scenes/layout.ts`; then check the test's tap points and the art
  that reads `GROUND_Y` and `VIEW` (pit depth and blade length in `scenery.ts`). A new position
  that is not centred or left-pinned also gets its move in `fitLayout` (or `HUD_SHIFT`), so it
  follows a wider or taller view.
- Save more between runs: extend `src/game/save.ts`, keep keys prefixed `hotfoot-`, and carry the
  new field through `newRun`, `persist` and the game-over panel.
- Change the shop: `buyMissed` in `src/game/sim.ts` (price, what can be bought) and `drawGameOver`
  in `GameScene` (its wording and button). The shop is off the playthrough's path on purpose.
- Restyle an object: its sprite is painted in `scenery.ts`, `foes.ts`, `knight.ts`, `icons.ts` or
  `hud.ts` with the `ink.ts` helpers. Keep the texture's size and its origin in `GameScene` (feet on
  the road; see Gotchas), or change both together.
- Add a terrain: add it to `Terrain` and `TERRAIN` in `state.ts`, apply its rule in `stats` or
  `tick`, place it in `terrainOf`, paint its road in `GROUNDS` in `scenery.ts` (key
  `ground-<terrain>`), and give it a line in `drawCaption`'s `onward` and, if it has weather, in
  `drawWeather`. Stage 2's terrain is on the playthrough's path (it asserts `ice`).
- Tune a boss: `BOSS.gate` or `BOSS.dragon` in `boss.ts`, `BOSS_EVERY` and `DRAGON_AT` in
  `state.ts`. Its art's head height must match its `h` (`GATE_ART` and the 0.43 scale, or
  `DRAGON_ART` and the tired pose's head at page y -186, in `foes.ts`). A new missile kind is a
  `TrapKind` with a `TRAP_SPAN` entry, a place in `MISSILES`, its art and a sprite case in
  `drawWorld`/`drawTrap`, and a caption line.
- Add a boon pair: a `PAIRS` entry in `pairs.ts`, a flag in `stats` and its effect in `sim.ts`
  (as `GLIDE`, `HOARD` and `BULWARK_REACH` are applied). The card hint and the game-over listing
  follow on their own.
- Add a dare: a `DareKind` with its goal in `DARE.goals`, its words in `DARE_TEXT` (and the `i18n/` files), a place in
  `DARE.kinds` (the order by stage) and a `dared(s, kind, n)` call where it moves on, or a check
  at the checkpoint like the no-hit dare's. Its progress string is in `drawHud`.
- Tune the roads: `ROAD` in `state.ts` (first stage, streak cap, gaps), the pool in `piecesOf`,
  the extra coins in `planOf`, and the cards' words in `ROADS`. Moving `ROAD.from` to 2 puts the
  road choice on the playthrough's path (the test would then need to tap a road card after the
  boon).
- Tune the rockfall: `ROCK` in `state.ts` and `BOULDERS` in `GameScene` for the look. Its stage
  rule is `isRockStage`.
- Add a cursed boon: a `BOONS` entry with `cursed: true` and `maxRank: 1`, its gift and price in
  `stats`, and an icon; `rollChoices` offers it on its own.
- Add an armoury item: an `ARMOURY` entry and `ARMOURY_EACH` value, its effect in `stats` or
  `newRun`, an icon (`ARMOURY_ICONS` in `icons.ts` unless a boon's fits), and a row y in
  `ARMOURY_PANEL.rowY`.
- Tune the streak or the shrine: `STREAK` and `SHRINE` in `state.ts`; the test's `STREAK` copy and
  the README's rules must follow. Moving the shrine to stage 1 puts it on the playthrough's path:
  the test would then need to handle it (it is harmless, so only the assertions change).
- Change the run track: `trackOf` in `state.ts` (the numbers) and the track part of `drawHud` and
  `TRACK` in `layout.ts` (the drawing).

## Gotchas

- Trap widths must have a baked texture: `planOf` makes spikes 36/48/60 and pits 80/96/112 wide, and `scenery.ts` bakes `spikes-<w>` and `pit-<w>` for exactly those widths.
- The blade art hangs to 34 px above the road (`blade()` in `scenery.ts` ends at `GROUND_Y - 34`); it
  must match `TRAP_SPAN.blade.lo`, which must stay above `RUNNER.slideH` (26) and below `RUNNER.h` (60).
- The knight's texture origins come from `KNIGHT_FEET` in `knight.ts`: the standing poses are
  104x100 px with the feet at (52, 94), and the slide is 108x42 px with the feet at (66, 38). Change
  the sizes and the feet together, or the knight floats or sinks. The goblin's origin comes from
  `GOBLIN_ART` (feet at row 51 of 54, centred so a flipped goblin stays put).
- The knight's tabard cross and the checkpoint banner's cross are gold leaf; the Field Dressing's is
  green. Never paint a red cross.
- A new sprite's origin is part of its look: spikes and fire vents stand on the road by their
  bottom-left, a pit hangs from 2 px above the road by its top-left (its art cuts through the turf
  and the frame's bottom rule into the margin, `PIT_DEPTH` 64), the goblin stands centred on its
  feet, the shrine stands by its bottom middle, and the blade hangs centred from the top of the
  screen (its art is 46 px wide, wider than the trap's 26, for the side spikes).
- `buildStage` relies on `nextId` and `stageStart`/`checkpointX` being set first; `nextStage` sets
  them before calling it. Traps and coins of the next stage are appended, not replaced.
- A collected coin gets `x = NaN` and is filtered out at the end of the same `tick`.
- `pick` sets `shields` from `stats`, so Aegis charges refill only when a boon is taken at a
  checkpoint, never mid-stage.
- `pick` stays in `checkpoint` while `roads` is set: a caller that starts the next stage itself
  must call `pickRoad` then, as `GameScene` does from the road cards.
- The dragon's stage comes from `dragonStage` (metres of `stageStart`), not a stage number, so
  it lands on whichever stage starts past 1500 m (around stage 16 after two Gatekeeper stages)
  and takes the place of a Gatekeeper's, a rockfall's or a road's stage.
- A screenshot script that pokes `state` from outside sees long frames in headless Chromium
  (`MAX_STEP_MS` each), so a coin dropped right under the knight can be jumped over in one frame;
  spread test coins along the road instead.
- The test's choice of which boon to pick depends on the seeded `rollChoices` order; changing the
  number of `Math.random` calls in `buildStage` changes both the course and the boons offered.
  `planOf` draws its random sizes before `buildStage` checks the piece fits, so a piece that does
  not fit still uses up its draws.
- `OPENING` pieces are spaced by the minimum gap so all four always fit in stage 1; random pieces
  after it use the full gap range.
- The `ledge` texture is 72x128 px; a ledge taller than about 118 px would need it baked taller.
- Scrolling layers (`far`, `near`, `ground`, `ledge`) must wrap: `far` and `near` paint every
  piece three times, a page-width apart, so the seam matches.
- Texts redrawn every frame (`setText`) only re-render when their string changes; keep it that
  way, since the canvas renderer is what the playthrough uses.
- A bat's meeting point assumes the knight runs at `speedOf(stage)` the whole way. On the Windy
  Pass the knight runs slower in the air, so a bat there arrives a little early; nothing else
  changes speed mid-stage.
- A Gatekeeper's stage is longer than 100 m (its checkpoint waits on the fight), so banners after
  it no longer fall on hundreds; `trackOf` draws the passed ones from `banners`.
- An ordinary run never draws from the daily seed, and a daily run never touches `Math.random` in
  the course or the boon offers; keep new course randomness on `rand(s)`.
- Hearts in the HUD are created up to `maxHearts` and never destroyed; extra ones are hidden.
- Healing art uses green (`C.heal`). Never draw a red cross (root `AGENTS.md`).
