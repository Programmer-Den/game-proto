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
  (`SETS`) and the weekly one, the terrain and duo toggles and START MATCH (greyed out on a locked
  commander or a daily lobby already tried today, `canStart`), the campaign and daily lobby cards
  under them, and the saved stats, rank and saved squads at the bottom. The Workshop button at the
  top right switches `menu.screen` to `'workshop'`.
- Commander unlocks (`progress.ts`): Grit, Sparks and Magna are open; the other five each have an
  `unlock` deed (`DeedId`): `topFour` (Rosa, Patch-Up), `threeStar` (Volt, Power Surge),
  `fullOrigin` (Hexa, EMP Blast: a won fight with an origin at 6), `maxLevel` (Ironside, Rally Cry)
  and `champion` (Nova, Air Strike). `GameScene.noteDeeds` saves them: `planDeeds` every plan
  tick, `fullOrigin` in `finishFight`, `topFour` and `champion` in `record`; a new unlock floats
  "New commander" over the board and is listed on the end screen. Watched matches never count.
- Seasons: each `SetDef` lists six origins; `rosterOf(set)` gives its 34 robots (six per origin,
  one per class, costs 1 to 5, plus the four Clockwork robots, `CLOCKWORK`, in both seasons).
  Scrap Rush adds scrap tokens on wins (`SCRAP_TOKENS_PER_PART`), Overcharge gives every robot
  `OVERCHARGE_MANA` at the start of a fight. `UNITS` holds all 46 robots.
- Clockwork and Bomber: the Clockwork origin (tiers 2/4) winds up once at `WIND_UP_S` into a
  fight (`Battle.step` adds its trait value to `rampAs`; an Overclocker ramps `itemRamp` apart,
  so the two stack). Its 2- and 4-cost robots are the only
  Bombers, a seventh class (tier 2, more bomb damage) whose `bomb` ability lobs a shell at the
  enemy with the most others next to it and hits them all, the neighbours by `BOMB_SPLASH`.
  `paint.ts` draws the clock-face head and the Bomber's shoulder mortar.
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
- Power cards (`AUGMENTS`): offered at rounds with `augment` set (2-1, 3-2, 4-2, 5-2) and picked with
  `pickAugment`. From `RARE_FROM_STAGE` (4) `offerAugments` puts a `rare` card in the third slot,
  drawn gold-edged with a RARE tag: `free-rolls` (`Player.freeRolls`, reset to `RARE.freeRolls` in
  `startPlan`, makes `rerollCost` 0 and the Reroll button read "Reroll free"), `hand-to-mouth`
  (`startPlan` pays `RARE.handToMouthGold` instead of interest) and `gilded-shop` (`rollShop` uses
  `RARE.gildedChance` from level 1). Duplicator pays the robot's cost in gold instead when the bench is full. While
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
- Weekly season: the menu's third season card (`menu.set` `'weekly'`). `weekOf(Date.now())` (UTC
  weeks from Monday) picks `weeklyRules(week)` from `WEEKLY_ROTATION` (season and terrain), which
  `startMatch` uses instead of the menu's (the terrain toggle is greyed out), and passes the week as
  `MatchOptions.weekly`. `record` keeps the week's best place in `Progress.weekly` (`recordWeekly`);
  the card and the end screen show it (`weeklyBest`). A new week starts unplayed.
- Trophies (`src/trophies/`, `shared/trophies.ts`): ten, saved under `scrapyard-titans-trophies`.
  `index.ts` lists them (id, tier, icon; `titanRank` and `weeklyWin` hidden) with their texts in
  `trophies/i18n/` (`en.ts`, `de.ts`; the name keyed by the id, what earns it by `<id>Text`) and
  imports nothing else from the game, since the hub loads it. `main.ts` hands `trophies` to
  `setupGame`. `GameScene` awards them, never under `?watch`: `firstWin` in `finishFight` (a won
  fight), `rareCard` in `doAugment`, `weeklyWin` in `record` (1st in a weekly match), and
  `awardProgress` the rest from `Progress`: each deed's trophy shares its id (`topFour`,
  `threeStar`, `fullOrigin`, `maxLevel`, `champion`), `allCommanders` when every commander is
  unlocked and `titanRank` at the top rank. `create` runs it quietly, so deeds saved before the
  trophies came in earn theirs without a toast.
- Junkyard campaign (`CAMPAIGN`, `LobbyDef` in `data.ts`): ten fixed lobbies, each with its
  season, terrain, rival `rank` and `seats` (indexes into `RIVALS`, or `b0` to `b2` for `BOSSES`),
  a `goal` place and a `reward` (a robot of a shared origin, or a part). The menu's wide card
  (`menu.set` `'campaign'`) plays `nextLobby(progress)`; `startMatch` passes `MatchOptions.lobby`,
  the lobby's rank and `kit` (`campaignKit`: every cleared lobby's reward), and `newMatch` seats
  `lobbyRivals(lobby)` (so a match can have 4 to 8 seats) and puts the kit on the bench and the
  item bench. Bosses (`CommanderDef.boss`) get `BOSS.hp` health and `BOSS.gold` more a round in
  `startPlan`. `record` checks `lobbyCleared` (the goal place or better, every boss out before the
  player) and `clearLobby` moves `Progress.campaign` on; the end screen says cleared (with the new
  kit piece) or what it asks for.
- Squad replays: `record` saves the player's final board of a won match (`squadOf`, a
  `SavedSquad`) with `saveSquad`, keeping the newest `GHOST.keep` under `scrapyard-titans-squads`
  (`loadSquads` drops any that name a robot, item or card that no longer exists). `startMatch`
  hands one at random (`pickSquad`) to `MatchOptions.ghost`; on round 4-7 (`GHOST`,
  `isGhostRound`) `startFight` gives the player that squad (`ghostSide`, mirrored, with its
  commander's skill and power cards) instead of the monsters, sets `Match.ghostSquad`, and a loss
  costs `GHOST.lossDamage`. The rivals fight the monsters as usual. Never under `?watch`.
- Rank ladder (`RANKS`, `RANK_POINTS` in `data.ts`): `Progress.points` grow by a top-four place in
  `record` (`addRankPoints`) and never drop; `record` reads a campaign lobby's place on the 8-seat
  scale for the best place, rank points and the `topFour` deed (`ceil(place * 8 / seats)`, so 4th
  of 4 counts as 8th), and a duo team's as 1st, 3rd, 5th or 7th; `rankOf(points)` gives the
  rank, which `startMatch` passes as `MatchOptions.rank` (0 under `?watch`). The rank gives each rival `gold` more a round
  in `startPlan`, rolls the rivals' shops `odds` levels higher in `rollShop`, and lets `aiPlan`
  reroll from stage `rollFrom` while holding more than `rollAbove` gold (seat 0 always uses Rust's).
  Rank 0 plays exactly as before. The menu shows it under the stats, the end screen the points won
  or the rank up.
- Robot workshop (`buildWorkshop`, ST4): pick a chassis (`CHASSIS`, origins both seasons share)
  and a weapon (`WEAPONS`, every class, named by `WEAPON_NAMES`), name it (Rename opens the
  browser's `window.prompt`; `suggestName` from `NAME_PARTS` fills it first) and Build
  (`addBuild`). Pieces unlock with first campaign clears (`WORKSHOP_UNLOCKS`, read from
  `Progress.campaign` by `workshopParts`, so older saves get theirs at once); the end screen lists
  a clear's new pieces (`piecesNow`). Up to `WORKSHOP.slots` builds are saved under
  `scrapyard-titans-workshop` (`loadBuilds`, `scrapBuild`; when saving fails, `loadBuilds` hands
  back the list kept in memory until the page closes); `register` puts them into `CUSTOM` and
  `UNIT_BY_ID` as `UnitDef`s with `custom` and the typed `label` (shown by `unitName` in `i18n.ts`)
  costing `WORKSHOP.cost`. `startMatch` sets `MatchOptions.custom` when any exist (not in the daily
  or under `?watch`), and `poolOf(m)` (`rosterOf(set, custom)`) adds them to every shop, draft and
  Duplicator roll, the rivals' too. `paint.ts` gives them a gold chest stripe; `bakeUnit` paints a
  build's texture and the workshop's previews (`pieceKey`, `unit:pv-<origin>-<class>`).
- Daily lobby (ST5, `shared/daily.ts` under `scrapyard-titans-daily`): the menu's green card
  (`menu.set` `'daily'`). `dailyRules(day)` seeds the season, terrain, a lent commander (any of
  the eight, locked or not) and the rivals (`RIVALS` shuffled, at `DAILY.bossChance` one swapped for
  a boss) from the date; `startMatch` calls `startDailyTry`, sets `useRand(dailyMatchRand(day))`
  (`game/rng.ts`) for the whole match, passes `MatchOptions.daily` (which gives every seat its own
  seeded shop stream, `Match.shopRand`) and `rivals`, rank `DAILY.rank`, no ghost squad and no
  workshop robots. `record` calls `finishDailyTry` (score `9 - place`); `dailyRecord` reads it for
  the card and the end screen. Play again goes back to `Math.random` (`useRand(null)`).
- Duo mode (ST6, `MatchOptions.duo`, the menu's Duo toggle in the two plain seasons): `Player.team`
  pairs seats 0-1, 2-3, 4-5 and 6-7; seat 1 (Baron Bolt) is the player's AI partner (`partner`).
  Teammates start with `DUO.hpScale` times the health and `endFight` takes a loss off every
  teammate's bar alike; `startFight` pairs teams in a ring so nobody meets a teammate;
  `knockOuts` drops a whole team and places count teams (`teamsLeft`, `teamCount`), and `record`
  counts a team place as `2 * place - 1`. Ranks and difficulty gold apply only to `isRival` seats.
  During planning `BUTTONS.pass` (left of the bench) reads Pass with a robot selected
  (`passUnit`, stars and items go with it) or Give 2g (`giveGold`, `DUO.gift`); G does the same.
  The partner plans in `beginPlan` and again in `goFight` with what it got. The players list joins
  each team with a bar and tags the partner; the result banner adds the partner's outcome
  (`Match.result.partner`).
- Progress (matches, wins, best place, `deeds`, rank `points`, `weekly` best and `campaign` lobbies cleared) saved under `scrapyard-titans-stats`
  (`progress.ts`, `loadProgress`/`saveProgress`); watched matches never count.

Missing or rough:

- No pathing beyond one tile step at a time toward the target.
- AI rivals use a simple scored plan (`aiPlan`). Balance is checked with AI-only matches (see
  Gotchas); every origin's average place (Clockwork about 4.8) sits between about 4.0 and 4.9 of 8, and matches end
  around stages 5 and 6.
- Only the weekly season and the daily lobby change by date; the two plain seasons are picked on the menu.

## Architecture

File map (`src/`):

- `main.ts`: creates the `Phaser.Game` (960x540) with `GameScene`, calls `setupGame(game,
  { howToPlay, trophies })` and `setupScaling(game, { fill: true })` (the view takes the screen's shape,
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
- `game/rng.ts`: `rand`, which every random draw in `game/` uses, and `useRand` (the daily seeds it).
- `progress.ts`: what lasts between matches (`Progress`: stats, deeds, rank points, campaign),
  the workshop (`Build`, `loadBuilds`, `addBuild`, `scrapBuild`, `buildDef`, `workshopParts`,
  `unlockedBy`, `suggestName`, `cleanName`), the daily lobby (`dailyRules`, `dailyMatchRand`,
  `dailyRecord`, `startDailyTry`, `finishDailyTry`),
  `rankOf`, `addRankPoints`, `weekOf`, `weekStart`, `weeklyRules`, `weeklyBest`, `recordWeekly`,
  `isUnlocked`, `doDeeds` (saves new deeds, returns the commanders they unlock), `planDeeds`,
  `fullOrigin`, the campaign's `nextLobby`, `campaignKit`, `lobbyCleared`, `clearLobby`, and the
  saved squads' `loadSquads`, `saveSquad`, `pickSquad`. No Phaser.
- `trophies/`: the game's trophies (see Current state).
- `audio.ts`: the songs (`PLAN_SONG`, `FIGHT_SONG`) and the sound table (`play`, typed `Sfx`); see
  Sound below.
- `game/data.ts`: every rule and number (see above). Every name and text in its tables (robots,
  seasons, abilities, traits, parts and items, power cards, skills, commanders and taunts,
  monsters, terrain) is a `TextKey` of `i18n/en.ts`, which the scene shows with `t`. No Phaser.
- `game/battle.ts`: `Battle(a, b, terrain)` with `step()` (fixed `STEP_S` 0.05 s), `useSkill`,
  `zapRat`, `runToEnd`, and `events` (`BEvent`) the scene drains for animation. No Phaser.
- `game/match.ts`: the `Match`, `Player` and `SavedSquad` types (`Player.name` and `Match.taunt.text` are
  `TextKey`s too), `squadOf`, `isGhostRound` and every action: `newMatch`, `rollShop`, `reroll`, `buyXp`, `buy`, `sell`, `moveUnit`, `equip`, `giveItem`, `pickAugment`, `startPlan`,
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
  `Player.maxHp`, which scales its bar in the players list; times `DUO.hpScale` for a duo team), and
  `startPlan` gives each rival (`isRival`, so not the duo partner) `byDifficulty(-1, 0, 1)` gold a
  round. Keep the README rows in step.
- Reduced motion: no camera shake on slams, no hit flash, no idle sway or orb bob, no avatar walk
  bounce or skill hop, and stun stars and the draft ring stand still instead of circling.
- Watch AI (`?watch`): the scene starts a match at once with a random commander (any of the eight), season and
  terrain, seat 0 is AI-run (`human` false: `aiPlan` once, near the end of each plan phase, where the
  rivals plan in `beginPlan`; skill at 3 s;
  the taps and keys that act for the player, R, X, E, L, G, 1-3 and Space, do nothing: the shop cards,
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
| `buy`, `starUp` (when the buy merges three) | `doBuy`; `starUp` also for the workshop's Build (`doBuild`) |
| `reroll`, `xp`, `levelUp` | `doReroll`, `doXp`; `levelUp` also in `beginPlan` when income XP levels up |
| `sell` | `doSellUnit` (Sell button, E, drag to the sell zone); the workshop's Scrap |
| `place` | `doMove` (a robot moved or swapped by tap or drag), `doPass` (a robot handed to the duo partner) |
| `bolt`, `itemBuilt` (two parts make an item) | `doEquip` |
| `latch` | `toggleLock`, `toggleSpeed` |
| `tick` | `tick`, each of the plan phase's last 3 seconds (player only) |
| `fight` | `goFight` |
| `augment`, `draft` | `doAugment`; the player's draft pick in `onDown` and its timeout pick in `tickDraft` |
| `punch`, `shot`, `shell`, `snipe` | `consume`: `attack` (melee only), `proj` by kind |
| `hit`, `crit` | `consume`: `dmg` |
| `castShield`, `castSlam`, `castBarrage`, `castSnipe`, `blink`, `castRepair` | `consume`: `cast` by ability (`CAST_SOUND`, a Bomber's `bomb` plays `castBarrage`); `blink` also on `blink` |
| `lightning`, `heal`, `shield`, `stun`, `dodge`, `revive`, `death`, `escape` | `consume`, the event of that name |
| `skill` | `consume`: `skill` (the rival's at 0.6 volume) |
| `zap` | `onDown`, the player's tap on the Scrap Rat |
| `orb` | `drawCommanders`, when the avatar picks an orb up |

Shared sounds: `ui('coin')` for the player's `gold` events in a fight and Give 2g in duo mode; `ui('click')` for the menu
choices, START MATCH, Play again, scouting a rival and flipping the info panel; `ui('refuse')` for
a refused buy, reroll, Buy XP, skill, move (board full) or equip (robot full), and for a tap on any
greyed-out button or shop card (`button` pushes a refusal for them).

## Testing hooks

- `window.game` in dev builds; the test reads `game.scene.getScene('Game').state` (the `Match`)
  and waits until the scene is active and the shared loading screen is gone.
- `e2e/playthrough.spec.ts` plays round 1-1: START MATCH (`START_BUTTON` 635,383), the first shop
  card (`SHOP_CARD_1`), bench slot 0 (`BENCH_SLOT_1`), tile 3,4 (`FRONT_TILE`), FIGHT
  (`FIGHT_BUTTON`); it asserts the bought robot moves bench → board, the fight is won with no
  damage, a part drops, the damage meter (`Match.meter`) lists the robot with damage dealt, and
  round 1-2's plan starts with income paid, and the win saved the `firstWin` trophy. Change these together with
  `layout.ts` (`SHOP`, `BENCH`, `BUTTONS.fight`, `BOARD_VIEW`), the menu's START MATCH rect in
  `buildMenu`, `ECONOMY.startGold`, and round 1-1's monsters (`MONSTERS.mite`), which every 1-cost
  robot must beat alone.
- Screenshots: `docs/screenshots/menu.webp` (duo on), `campaign.webp` (the campaign card picked), `daily.webp` (the daily card picked) and `workshop.webp` are from a scratch run with two deeds, 285 rank points, five lobbies cleared and two workshop builds saved; `duo.webp` is that run's duo match on round 1-1 with a robot selected (Pass showing) and a workshop robot set into the shop from the dev console; `fight.webp` (also
  `cover.png`), `draft.webp` and `scrap-rat.webp` are from a scratch `?watch` run with the watch
  panel hidden; `scout.webp`, `part-preview.webp` and `damage-meter.webp` from a scratch run that
  plays round 1-1 with real clicks; `german-result.webp` is the test's `3-result` run with a
  `de-DE` browser locale; `campaign.webp` (the menu with five lobbies cleared and a saved squad,
  the campaign card picked), `boss-lobby.webp` (lobby 6 with a Clockwork board set from the dev
  console) and `ghost-round.webp` (that board fighting a saved squad on round 4-7, set from the
  console) are from a scratch run; `trophies.webp` is the pause screen's Trophies list from a scratch run with five trophies saved; `rare-card.webp` is a scratch run's 4-2 offer (set from the dev console) with Lucky Dice in the third slot; `fill-ultrawide.webp` (2560x1080) and `fill-tablet.webp` (1024x768)
  show the plan phase on a wider and a taller view, from a scratch run.

## Making common changes

- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and, when it spells armour, honour or grey, the US spelling in `i18n/en-US.ts`; run
  `node scripts/check-translations.mjs`. German runs longer: the Reroll, Buy XP, Sell and Lock
  buttons, the shop cards' trait lines and the players list are the tightest spots, so check a new
  text with `?lang=de`.
- **Add a robot**: add it to `UNITS` with an origin of its season, a class and its name's key (in
  the `i18n/` files); give its origin a head in `paint.ts` if the origin is new. Keep six per
  origin, one per class (Clockwork, the shared extra origin, has four).
- **Add an origin or class**: add it to the ids, `TRAITS`, `ORIGIN_COLOR` and `EYE` in
  `paint.ts` (origins), a season's `origins` and, for a class, `CLASS_STATS` with an ability the
  sim handles in `battle.ts`, its arms in `paint.ts` and its cast sound in `CAST_SOUND`.
- **Add an item**: add a part to `PARTS`/`PART_DEFS` (every pair then needs a combo) or change a
  `combo` row; a new `Special` needs handling in `battle.ts`.
- **Add a workshop piece**: a chassis must be an origin in both seasons (`CHASSIS`); a weapon is a
  class (`WEAPONS`, with its name key in `WEAPON_NAMES`). Give it a lobby in `WORKSHOP_UNLOCKS`.
- **Change duo mode or the daily lobby**: `DUO` and `DAILY` in `data.ts`; the daily's rules are
  `dailyRules` in `progress.ts`. Every random draw in `game/` goes through `rand` (`game/rng.ts`),
  never `Math.random`, so the daily stays the same for everyone; a seat's shop uses its own stream
  (`Match.shopRand`). Check duo with the balance harness and `duo: true` (with `hpScale` 2 its
  matches ended around 5-2 against 5-5 alone when it came in).
- **Change the campaign**: a row in `CAMPAIGN` (name key `lobby<n>` in the `i18n/` files, the
  menu's pips and `lobbyGoal` follow it); a new boss goes into `BOSSES` (name and taunt keys) and
  is seated with `b<index>`. Keep the rewards to robots of origins both seasons share, or parts.
  Check a change with the balance harness on `lobby` matches (the AI seat cleared about 17, 16, 12,
  7, 10 and 4 of 30 tries at lobbies 1, 3, 5, 6, 9 and 10 when it came in).
- **Add a commander**: a row in `PLAYER_COMMANDERS` (name key, skill, colours, `unlock` deed), its
  skill in `SkillId`, `SKILL_POWER` and `SKILLS`, handled in `Battle.useSkill` and drawn in
  `consume`'s `skill` case; a new deed goes into `DeedId`, `DEEDS` in `progress.ts`, a
  `<deed>Unlock` text and a `noteDeeds` call where it happens. The menu row holds eight cards. Bosses are drawn from
  `BOSSES` too (`bakeAll`).
- **Add a power card**: add it to `AugmentId`, `AUGMENTS` and `AUGMENT_TASTE` in `ai.ts`, then
  apply it in `match.ts` (one-off) or `battle.ts` (in fights).
- **Change the rank ladder**: a row in `RANKS` (with its name and text keys), the points in
  `RANK_POINTS`; check the effect with the balance harness at each rank.
- **Change rounds or damage**: `stageRounds`, `stageDamage`, `SURVIVOR_DAMAGE`.

## Gotchas

- Balance: a scratch harness bundles `src/game` with rolldown (`node_modules/.bin/rolldown`),
  stubs `location` and `localStorage`, and plays AI-only matches in node (`newMatch` with
  `watch: true`, then `startPlan`/`aiPlan`, `startFight` and `runToEnd`, `endFight`, `advance`,
  drafts through `aiDraft`), recording each seat's place and main origin. Call
  `m.battle?.runToEnd()` before `endFight`, since `startFight` leaves seat 0's fight for the scene
  to play back. Run one after changing a
  trait, a class or `stageDamage`. `startFight` copes with seat 0 being out for this.
- The bench slots are drawn on the board layer (`drawBoard`), under the benched robots; HUD
  graphics sit above every robot.
