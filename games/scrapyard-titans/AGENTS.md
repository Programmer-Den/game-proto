# Scrapyard Titans: guide for agents

How Scrapyard Titans is built and where things stand, for agents changing it. README.md covers how
to play, the robots, traits, items and the difficulty. Keep this file up to date with any change to
the game, per the root AGENTS.md.

## Current state

A single-player board auto-battler: eight commanders (the player and seven AI rivals) buy robots,
place them on their half of an 8x8 board and watch them fight. The art is a cel-shaded arena in
fake 3D, all painted in code at start-up; the only image files are the cover and the favicon.

Implemented today:

- Menu: eight commanders (`PLAYER_COMMANDERS`, each with one skill in `SKILLS`) as small cards,
  with the picked one's skill (or, while locked, its unlock) spelled out under them, two seasons
  (`SETS`) and a terrain toggle, then START MATCH (greyed out on a locked commander). The menu shows
  the saved stats.
- Commander unlocks (`progress.ts`): Grit, Sparks and Magna are open; the other five each have an
  `unlock` deed (`DeedId`): `topFour` (Rosa, Patch-Up), `threeStar` (Volt, Power Surge),
  `fullOrigin` (Hexa, EMP Blast: a won fight with an origin at 6), `maxLevel` (Ironside, Rally Cry)
  and `champion` (Nova, Air Strike). `GameScene.noteDeeds` saves them: `planDeeds` every plan
  tick, `fullOrigin` in `finishFight`, `topFour` and `champion` in `record`; a new unlock floats
  "New commander" over the board and is listed on the end screen. Watched matches never count.
- Seasons: each `SetDef` lists five origins; `rosterOf(set)` gives its 30 robots (six per origin,
  one per class, costs 1 to 5). Scrap Rush adds scrap tokens on wins (`SCRAP_TOKENS_PER_PART`),
  Overcharge gives every robot `OVERCHARGE_MANA` at the start of a fight. `UNITS` holds both
  seasons' 42 robots.
- Traits: `TRAITS` (origins tiered 2/4/6, classes 2/4), counted per distinct robot on the board
  (`countTraits`), read in the sim with `traitValue`.
- Shop and economy (`ECONOMY`, `LEVEL_XP`, `SHOP_ODDS`): 5 cards, reroll, buy XP, interest,
  streak bonus, levels 1 to 9 (the level is the robots allowed on the board). Gilded robots
  (`GILDED`) count a second origin, cost 2 more and never merge.
- Star-ups: `addUnit` merges three copies of the same star into the next star (up to 3), keeping
  their items up to `MAX_ITEMS` and sending the rest to the player's parts.
- Items: six parts (`PARTS`) and 21 finished items (`COMBOS`, `comboOf`); `equip` bolts a part on
  and builds the finished item when a robot already carries a lone part. The item bench holds
  `ITEM_BENCH` (10): every part or item a player gets (drops, sales, star-ups, drafts, power cards,
  scrap tokens) goes through `giveItem`, which scraps it when the bench is full. The scene then
  floats "Parts full" (`partsFull`) over an orb or the item bench instead of the item's name.
- Power cards (`AUGMENTS`): offered at rounds with `augment` set (2-1, 3-2, 4-2) and picked with
  `pickAugment`. Duplicator pays the robot's cost in gold instead when the bench is full. While
  the card overlay is up, taps and keys other than 1-3 do nothing.
- Rounds (`stageRounds`): stage 1 is three neutral rounds and a draft; later stages are
  pvp, pvp, pvp, draft, pvp, pvp, then a monster round (2-7 is the Scrap Rat, `RAT`).
  `stageDamage` and `SURVIVOR_DAMAGE` set what a loss costs.
- Fights (`battle.ts`): both squads on one 8x8 board (side 0 on rows 4-7, side 1 mirrored onto
  rows 0-3), Chebyshev range and targeting, one robot per tile, charge (mana) and the class
  abilities, trait and item specials, commander skills (`useSkill`, numbers in `SKILL_POWER`),
  terrain (`TERRAIN`), and
  `FIGHT_LIMIT_S`. The player's fight is played back step by step; every other pairing runs
  `runToEnd` at once.
- Pairings: `startFight` pairs the living seats at random, avoiding last round's opponent; with an
  odd count one seat fights a ghost copy of another board. Rivals call a taunt bubble at the start
  (`drawCommanders` hides it once Play again clears the match).
- Draft rounds (`startDraft`, `draftPick`): one robot with a part or item per living seat plus
  one, on a ring; lowest health picks first, `DRAFT_PICK_S` each.
- Commander avatars walk the board's near edge (`COMMANDER_HOME`) and collect monster drops (orbs),
  and the rival walks the far edge (`RIVAL_HOME`). The avatar walks by `GameScene.t`, so it keeps
  pace with the fight's speed and watch steps at any frame rate; the items themselves are granted
  in `endFight`.
- Scrap Rat round: the rat runs about the board; the player taps it to zap it (`zapRat`), and each
  hit on it shakes gold loose until it escapes.
- Speed button (1x/2x, T), reduced motion (no shake, flash, orb bob, idle sway, avatar hop,
  circling stun stars or turning draft ring).
- Shop lock (`Player.shopLocked`, `toggleShopLock`, the Lock button `BUTTONS.lock` or L):
  `startPlan` skips `rollShop` for a locked shop; `reroll` unlocks it. The AI never locks.
- Scouting: during planning a tap on a rival's row in the players list sets `GameScene.scout`;
  `syncViews` draws that rival's board mirrored onto rows 0-3 (views keyed `s<uid>`) and the info
  panel shows its level, gold, active traits and power cards. Cleared when a plan or fight starts.
- Damage meter: `BUnit.dealt` and `taken` (counted in `Battle.hurt`, overkill left out);
  `endFight` stores the player's side as `Match.meter` (`meterOf`, `MeterRow`), which the info
  panel shows in the result and plan phases (`buildMeter`). A tap on the panel switches it to the
  power cards (`infoPage`).
- Part preview: with a part or item selected or dragged, `buildPreview` tags each robot with
  `equipPreview(id, robot)` (the finished item, the part, or full), and the info panel lists the
  part's six recipes.
- Rank ladder (`RANKS`, `RANK_POINTS` in `data.ts`): `Progress.points` grow by a top-four place in
  `record` (`addRankPoints`) and never drop; `rankOf(points)` gives the rank, which `startMatch`
  passes as `MatchOptions.rank` (0 under `?watch`). The rank gives each rival `gold` more a round
  in `startPlan`, rolls the rivals' shops `odds` levels higher in `rollShop`, and lets `aiPlan`
  reroll from stage `rollFrom` while holding more than `rollAbove` gold (seat 0 always uses Rust's).
  Rank 0 plays exactly as before. The menu shows it under the stats, the end screen the points won
  or the rank up.
- Progress (matches, wins, best place, `deeds` and rank `points`) saved under `scrapyard-titans-stats`
  (`progress.ts`, `loadProgress`/`saveProgress`); watched matches never count.

Missing or rough:

- No pathing beyond one tile step at a time toward the target.
- AI rivals use a simple scored plan (`aiPlan`). Balance is checked with AI-only matches (see
  Gotchas); every origin's average place sits between about 4.0 and 4.9 of 8, and matches end
  around stages 5 and 6.
- Seasons are picked on the menu; nothing rotates them.

## Architecture

File map (`src/`):

- `main.ts`: creates the `Phaser.Game` (960x540) with `GameScene`, calls `setupGame(game,
  { howToPlay })` and `setupScaling(game, { fill: true })` (the view takes the screen's shape,
  960 to 1296 wide and 540 to 720 tall), and in dev builds puts `game` on `window`.
- `howToPlay.ts`: the How to play text in British English (US English spells it the same and falls
  back to it) and German, picked with `byLanguage`; update both when controls or the loop change.
- `i18n.ts` and `i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British English
  source (armour, honour), `i18n/de.ts` the German (with `keepEnglish` for names that stay as they
  are) and `i18n/en-US.ts` only the texts spelled differently in US English. `t(key, vars)` shows a
  text in the hub's language, `TextKey` types the keys and `ordinal(n)` writes a place (3rd, or
  just 3 in German, where the text says "Platz"). Every text on screen goes through `t`, and a new
  one gets its German entry (and a US one if its spelling differs) in the same PR. The watch
  panel's title and `aiLog` lines stay English, with the names inside them translated.
- `progress.ts`: what lasts between matches (`Progress`: stats, deeds, rank points), `rankOf`,
  `addRankPoints`, `isUnlocked`,
  `doDeeds` (saves new deeds, returns the commanders they unlock), `planDeeds`, `fullOrigin`. No
  Phaser.
- `audio.ts`: the songs (`PLAN_SONG`, `FIGHT_SONG`) and the sound table (`play`, typed `Sfx`); see
  Sound below.
- `game/data.ts`: every rule and number (see above). Every name and text in its tables (robots,
  seasons, abilities, traits, parts and items, power cards, skills, commanders and taunts,
  monsters, terrain) is a `TextKey` of `i18n/en.ts`, which the scene shows with `t`. No Phaser.
- `game/battle.ts`: `Battle(a, b, terrain)` with `step()` (fixed `STEP_S` 0.05 s), `useSkill`,
  `zapRat`, `runToEnd`, and `events` (`BEvent`) the scene drains for animation. No Phaser.
- `game/match.ts`: the `Match` and `Player` types (`Player.name` and `Match.taunt.text` are
  `TextKey`s too) and every action: `newMatch`, `rollShop`, `reroll`, `buyXp`, `buy`, `sell`, `moveUnit`, `equip`, `giveItem`, `pickAugment`, `startPlan`,
  `startFight`, `endFight`, `advance`, `startDraft`, `draftPick`, `newDrops`, plus helpers. No
  Phaser. A board is a record keyed `"col,row"` (rows 4-7).
- `game/ai.ts`: `aiPlan` (level, buy, sell, `arrange`, equip), `aiPickAugment`, `aiDraft`;
  reports to `aiLog` with side `p<seat>`.
- `art/paint.ts`: canvas painters for robots (a class body plus an origin head), monsters,
  commanders and part icons; `bakeAll` makes textures `unit:<id>`, `mon:<id>`, `cmd:<name key>` and
  `item:<id>` at `sharpRes` resolution.
- `scenes/layout.ts`: positions of every HUD block and button, and the board projection
  (`project`, `boardPoint`, `tileAt`), all designed for 960x540. `GameScene.create` calls
  `placeLayout` once with `viewSize` and `viewFrame`, which moves them in place for the real view
  (`VIEWPORT` holds its size and the frame offset `fx`, `fy`): the board, bench, Lock, commander
  homes and draft ring sit in the designed-size frame in the middle of the view, the shop and
  terrain legend in it sideways but down at the bottom edge, the left column's bottom panel and
  buttons (`LEFT_BOTTOM`, Reroll, Buy XP, Sell) at the bottom edge, the players list at the right
  edge and the info panel, Fight, skill and speed buttons at the bottom right. The traits and parts
  stay at the top left. At exactly 960x540 nothing moves. A new HUD position goes in `layout.ts`
  with its line in `placeLayout`.
- `scenes/GameScene.ts`: scene key `Game`. It imports `VIEWPORT` as `VIEW`, so `VIEW.w` and `h`
  are the view's size: the sky, stars and top bar cover the whole view, the arena rings follow the
  frame, and the menu, power card and end overlays are centred (x on `VIEW.w / 2`, y offset by
  `VIEW.fy`). The menu, the HUD (rebuilt when `dirty`), board and
  unit views (`syncViews`, `drawUnits`), fight playback (`consume` turns events into effects,
  numbers and orbs), drafts, commanders, and input (`onDown`/`onMove`/`onUp` for tap and drag,
  `onKey`).

The phase flow: `plan` (timed by `PLAN_S`) → `fight` → `result` → next round's `plan`, or `draft`
→ next round's `plan`; every plan after the match's first pays income and XP and rolls the shop.
`won`/`lost` end the match (`matchOver`; when the last commanders all fall in one round, the one
placed 1st wins). `GameScene.tick` drives it with the frame's delta; the fight advances
in `STEP_S` steps times the playback speed.

Shared code it imports: `shared/audio.ts`, `shared/setupGame.ts`, `shared/scaling.ts` (`setupScaling`, `sharpRes`,
`viewPoint`), `shared/settings.ts` (`byDifficulty`, `settings`), `shared/i18n.ts` (`translator`,
`byLanguage`, `Translation`) and `shared/watch.ts`.

### Hub settings

- Difficulty: `newMatch` gives the player `byDifficulty(130, 100, 80)` health (also its
  `Player.maxHp`, which scales its bar in the players list), and `startPlan`
  gives each rival `byDifficulty(-1, 0, 1)` gold a round. Keep the README rows in step.
- Reduced motion: no camera shake on slams, no hit flash, no idle sway or orb bob, no avatar walk
  bounce or skill hop, and stun stars and the draft ring stand still instead of circling.
- Watch AI (`?watch`): the scene starts a match at once with a random commander (any of the eight), season and
  terrain, seat 0 is AI-run (`human` false: `aiPlan` once, near the end of each plan phase, where the
  rivals plan in `beginPlan`; skill at 3 s;
  the taps and keys that act for the player, R, X, E, L, 1-3 and Space, do nothing: the shop cards,
  Reroll, Buy XP, FIGHT, Lock and the skill button are off and the Scrap Rat can't be zapped),
  and `mountWatch` shows the panel; `watchSteps()` ticks per frame. Watch another on the end screen
  starts the next match.

### Sound

All of it is in `src/audio.ts` and played from `GameScene`; the sim in `game/` has no audio. The
scene's `sfx(name)` wraps `play`: in `?watch` it drops `WATCH_QUIET` (hits, punches, shots, heals,
shields, dodges, the plan tick) and plays the rest at 0.6 volume. Only the player's own fight is
played back, so the other pairings (`runToEnd`) make no sound.

Music, industrial chiptune in E minor, two songs since the tempos differ (`playMusic` fades from
one to the other):

- `PLAN_SONG`, 110 BPM: `calm` (8 bars) from the menu (`create`) and every plan phase
  (`beginPlan`, and Play again); `draft` (4 bars, arpeggios) when a draft round starts
  (`afterResult`).
- `FIGHT_SONG`, 140 BPM: `battle` (8 bars) in `goFight`, `rat` (4 bars, chromatic chase) for the
  Scrap Rat round. Its stings: `roundWin`, `roundLoss`, `roundDraw` in `finishFight`; `matchWon` or
  `eliminated` in `afterResult` (after `stopMusic`), and `watchEnd` instead of both in `?watch`.

Sound table and where each plays:

| Sound | Where |
| --- | --- |
| `buy`, `starUp` (when the buy merges three) | `doBuy` |
| `reroll`, `xp`, `levelUp` | `doReroll`, `doXp`; `levelUp` also in `beginPlan` when income XP levels up |
| `sell` | `doSellUnit` (Sell button, E, drag to the sell zone) |
| `place` | `doMove` (a robot moved or swapped by tap or drag) |
| `bolt`, `itemBuilt` (two parts make an item) | `doEquip` |
| `latch` | `toggleLock`, `toggleSpeed` |
| `tick` | `tick`, each of the plan phase's last 3 seconds (player only) |
| `fight` | `goFight` |
| `augment`, `draft` | `doAugment`; the player's draft pick in `onDown` and its timeout pick in `tickDraft` |
| `punch`, `shot`, `shell`, `snipe` | `consume`: `attack` (melee only), `proj` by kind |
| `hit`, `crit` | `consume`: `dmg` |
| `castShield`, `castSlam`, `castBarrage`, `castSnipe`, `blink`, `castRepair` | `consume`: `cast` by ability (`CAST_SOUND`); `blink` also on `blink` |
| `lightning`, `heal`, `shield`, `stun`, `dodge`, `revive`, `death`, `escape` | `consume`, the event of that name |
| `skill` | `consume`: `skill` (the rival's at 0.6 volume) |
| `zap` | `onDown`, the player's tap on the Scrap Rat |
| `orb` | `drawCommanders`, when the avatar picks an orb up |

Shared sounds: `ui('coin')` for the player's `gold` events in a fight; `ui('click')` for the menu
choices, START MATCH, Play again, scouting a rival and flipping the info panel; `ui('refuse')` for
a refused buy, reroll, Buy XP, skill, move (board full) or equip (robot full), and for a tap on any
greyed-out button or shop card (`button` pushes a refusal for them).

## Testing hooks

- `window.game` in dev builds; the test reads `game.scene.getScene('Game').state` (the `Match`)
  and waits until the scene is active and the shared loading screen is gone.
- `e2e/playthrough.spec.ts` plays round 1-1: START MATCH (`START_BUTTON` 635,404), the first shop
  card (`SHOP_CARD_1`), bench slot 0 (`BENCH_SLOT_1`), tile 3,4 (`FRONT_TILE`), FIGHT
  (`FIGHT_BUTTON`); it asserts the bought robot moves bench → board, the fight is won with no
  damage, a part drops, the damage meter (`Match.meter`) lists the robot with damage dealt, and
  round 1-2's plan starts with income paid. Change these together with
  `layout.ts` (`SHOP`, `BENCH`, `BUTTONS.fight`, `BOARD_VIEW`), the menu's START MATCH rect in
  `buildMenu`, `ECONOMY.startGold`, and round 1-1's monsters (`MONSTERS.mite`), which every 1-cost
  robot must beat alone.
- Screenshots: `docs/screenshots/menu.webp` is from a scratch run with three deeds and 285 rank points saved; `fight.webp` (also
  `cover.png`), `draft.webp` and `scrap-rat.webp` are from a scratch `?watch` run with the watch
  panel hidden; `scout.webp`, `part-preview.webp` and `damage-meter.webp` from a scratch run that
  plays round 1-1 with real clicks; `german-result.webp` is the test's `3-result` run with a
  `de-DE` browser locale; `fill-ultrawide.webp` (2560x1080) and `fill-tablet.webp` (1024x768)
  show the plan phase on a wider and a taller view, from a scratch run.

## Making common changes

- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and, when it spells armour, honour or grey, the US spelling in `i18n/en-US.ts`; run
  `node scripts/check-translations.mjs`. German runs longer: the Reroll, Buy XP, Sell and Lock
  buttons, the shop cards' trait lines and the players list are the tightest spots, so check a new
  text with `?lang=de`.
- **Add a robot**: add it to `UNITS` with an origin of its season, a class and its name's key (in
  the `i18n/` files); give its origin a head in `paint.ts` if the origin is new. Keep six per origin, one per class.
- **Add an origin or class**: add it to the ids, `TRAITS`, `ORIGIN_COLOR` (origins), a season's
  `origins` and, for a class, `CLASS_STATS` with an ability the sim handles in `battle.ts`.
- **Add an item**: add a part to `PARTS`/`PART_DEFS` (every pair then needs a combo) or change a
  `combo` row; a new `Special` needs handling in `battle.ts`.
- **Add a commander**: a row in `PLAYER_COMMANDERS` (name key, skill, colours, `unlock` deed), its
  skill in `SkillId`, `SKILL_POWER` and `SKILLS`, handled in `Battle.useSkill` and drawn in
  `consume`'s `skill` case; a new deed goes into `DeedId`, `DEEDS` in `progress.ts`, a
  `<deed>Unlock` text and a `noteDeeds` call where it happens. The menu row holds eight cards.
- **Add a power card**: add it to `AugmentId`, `AUGMENTS` and `AUGMENT_TASTE` in `ai.ts`, then
  apply it in `match.ts` (one-off) or `battle.ts` (in fights).
- **Change the rank ladder**: a row in `RANKS` (with its name and text keys), the points in
  `RANK_POINTS`; check the effect with the balance harness at each rank.
- **Change rounds or damage**: `stageRounds`, `stageDamage`, `SURVIVOR_DAMAGE`.

## Gotchas

- Balance: a scratch harness bundles `src/game` with rolldown (`node_modules/.bin/rolldown`),
  stubs `location` and `localStorage`, and plays AI-only matches in node (`newMatch` with
  `watch: true`, then `startPlan`/`aiPlan`, `startFight` and `runToEnd`, `endFight`, `advance`,
  drafts through `aiDraft`), recording each seat's place and main origin. Run one after changing a
  trait, a class or `stageDamage`. `startFight` copes with seat 0 being out for this.
- The bench slots are drawn on the board layer (`drawBoard`), under the benched robots; HUD
  graphics sit above every robot.
