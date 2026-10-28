# Lane Brawl: guide for agents

How Lane Brawl is built and where things stand, for agents changing it. README.md covers how to
play, the champions, the upgrades and the difficulty. Keep this file up to date with any change to
the game, per the root AGENTS.md.

## Current state

Lane Brawl is a single-player MOBA on one 3500x3500 square map with three lanes, a river, towers,
inhibitors, minion waves, a jungle of twelve camps, watchstones, a guardian beast, tall grass, fog of
war, two Nexuses, five champions a side and a shop. The player picks one of fifteen champion classes,
from medieval fantasy to steampunk and beasts,
and fights with four AI allies against five AI champions on red. Each class is played by one named
champion with a story (`hero`, `title`, `motive` in `CHAMPIONS`), the same in every match. The art is toon low-poly 3D: every unit is a small mesh built in code and rendered at boot by a
software renderer into sprite frames, in three cel bands with a dark ink outline, and each champion
has an oversized hero head and a prop from their story; there are no image assets besides the cover and favicon.

Implemented today:

- Pick screen with the fifteen classes in three rows of five cards (3D figure, the champion's name,
  class and role, passive), two lines under them for the card under the pointer (`hoverPick`): the
  champion's name, title, class, blurb and story perk, then their motive; with no card under the pointer, the
  setting in one line. Then one match.
- Map (`WORLD` 3500x3500): every spot on it (Nexuses, lanes, towers, inhibitors, the river, camps,
  watchstones, bushes, runes, ward spots, the beast's and the drake's pits, the ruins and the jungle's paths) is
  written at the first 2800x2800 layout and scaled by `MAP_SCALE` (1.25) with `at` in `data.ts`.
  Widths (a lane's, the river's, a bush's, a clearing's, a path's) and every range stay as they are, and the
  pines, rocks, grass tufts and flowers grow in number with the map's area. To resize the map,
  change `MAP_SCALE` and the two map points in the playthrough (`RED_MID_TOWER` and its walk goal).
  The blue Nexus at the bottom left, the red at the top right; top and
  bottom lanes along the edges, the middle lane on the diagonal. Everything red is blue mirrored
  through the centre (`mirror`, `both` in `data.ts`), with top and bottom lanes swapped. Two towers
  per team per lane, an inhibitor per team per lane near its Nexus (`INHIBITORS`), the river
  (`RIVER`, top left to bottom right, crossing the middle lane), twelve camps (`CAMPS`), three
  watchstones on river islands (`WATCHSTONES`), the beast's pit by the river (`BEAST`), eighteen
  bushes (`BUSHES`), four ruins (painted only) and minion waves every 25 s (three per lane per team).
- Champions: fifteen classes (`CHAMPIONS`): ten medieval (Warden to Lancer) and five steampunk or
  beast (Gunslinger, Automaton, Tinker, Wolfkin, Bruin), each with a passive (`PassiveDef`: `tough`, `critEvery` and
  `critMult`, `haste`, `spellpower`, `aura`, `lifesteal`, `regen`, `slowHit`, `ambush`, `splash`)
  and Q, W, E, R. Abilities are data: `burst` (around a point or the caster, with optional `knock`),
  `bolt` (projectiles, optionally piercing, with optional `pull` or `executeBelow`), `dash` (move,
  hit where it lands), `ally` (heal, shield and optional `buff` for allied champions), `buff` (a
  timed `BuffDef` on the caster: attack speed, damage, speed, lifesteal, armor, cooldowns, regen,
  slowing hits or stealth) and `zone` (a lingering circle that hurts enemies by `dps` and slows
  them, in `s.zones`). R unlocks at level 3; levels run 1 to 8 (`XP_FOR_LEVEL`).
- Champions and lore: each `ChampionDef` carries `hero` (the text key of the full name, like
  `wardenHero` for Hald Oathstone, which `createGame` gives the unit as `name`), `short` (the first name for labels, the portrait and
  notices, through `shortName` in `names.ts`), `title` and `motive` (one line, at most 90
  characters, for the pick screen). A class shows up at most once per match, so names never clash.
  Three champions carry a `perk` (`StoryPerk`) from their story, applied in `sim.ts`: Morrow's
  `beastDmg` (25% more damage to the guardian beast, in `damage`), Kaida's `captureRate` (takes
  watchstones twice as fast, in `updateWatchstones`) and Rook's `bountyGold` (50% more gold from a
  bounty he claims, in `kill`).
  The setting (the Contest of Kessmoor) and each champion's story are in the README; ability,
  passive and upgrade names follow the stories, while ids (`wide-slam` and so on) keep the old
  names. Every name and line of a champion is a text key (see Languages below).
- Languages: every text on screen is in British English, US English or German, following the hub's
  Language setting (`?lang=de` for a quick look). `CHAMPIONS`, `ITEMS`, `UPGRADES`, `CAMP_KINDS`
  and `BUFFS` hold text keys of `i18n/en.ts` instead of texts (roles too, so `AI_BUILD_FOR` is
  keyed by role key), and the scene shows them with `t`. Notices are worded in `sim.ts` when they
  happen; an objective keeps its title as a key (`ObjectiveTitle`), worded when drawn. An upgrade
  has no text of its own besides its name: `upgradeText` in `GameScene.ts` words its one effect
  with the ability's name (`upRadius`, `upStun` and so on). The `?watch` log stays in English
  (`english` in `i18n.ts`), like the shared watch panel.
- Jungle (LB6): camps of five kinds (`CAMP_KINDS`): boars, wolf packs (an alpha and two pups, one
  `group`), and per side one ember and one moss brute, whose slayer gets a 60 s buff (`BUFFS`, in
  `Unit.buffs`). Hitting one camp wakes its pack; a camp heals 5% a second when left alone and
  ignores stealthed champions. `damage` spares a camp from a champion that neither targets it nor
  is already fighting it (`campSpares`), so splash and bursts from a lane fight don't steal or wake
  camps, and a bolt from such a champion flies on through the camp (`updateProjectiles`).
- Watchstones (LB6): `'watchstone'` units, neutral until a team's champions stand within
  `WATCH.radius` with no enemy champion there for `WATCH.captureMs` (`updateWatchstones`,
  progress in `Unit.capture`); a held one gives its team `SIGHT.watchstone` of vision.
- Fog of war (LB6): `updateVision` sets `Unit.hidden[team]` each tick for every unit no unit of that
  team sees (`viewers`: champions, minions, towers, inhibitors, Nexuses and held watchstones, each
  with its `SIGHT`), plus champions in a bush or stealthed. Structures and watchstones are never
  hidden. The view darkens what blue can't see on the map and the minimap (`updateFog`,
  `paintFog`) and skips hidden units, effects, projectiles and zones there.
- Gold (passive plus last hits and kills), XP shared by nearby champions, respawns that scale with
  level.
- Items (LB4): sixteen in `ITEMS`, bought near the Nexus (`atShop`, `SHOP_RANGE`) or anywhere while
  the champion is dead (`buy` skips the distance then), each owned once, at most `MAX_ITEMS` (6) in
  the bag. Seven are parts (the Healing Flask among them); five build `from` parts: buying one uses
  up the parts owned and takes their cost off its price (`priceFor`, `buy`); then the Vision Ward
  (below) and three elixirs. Items add flat damage,
  armor, health and speed, plus percent attack speed (`atk`) and cooldown reduction (`cdr`). Two add
  an `active` (`ACTIVES`): Phase Boots dash 220 px on D, the Healing Flask heals 220 on H (F is the
  hub's full screen key), through `useActive`, with cooldowns in `Unit.activeCds`; the third
  `ACTIVES` row is the ward on V. The shop is a 4x4
  grid of cards (the last row holds the ward and the elixirs); the bag shows as six slots in the portrait card
  and the actives as three narrow buttons under the shop button.
- Elixirs (#290): the Wrath, Iron and Swift Elixirs (`ItemDef.elixir`, a `BuffDef`) cost 400 and
  take no bag slot: `buy` swaps any elixir buff for a new `Buff` with `elixir: true` lasting
  `ELIXIR.ms` (3 minutes), named after the item and coloured by `ELIXIR_COLOR`. `kill` and `revive`
  keep elixir buffs, so they last through death. The shop card shows the time left of the one drunk.
- Vision wards (LB6, round 2): the `'ward'` item (`ItemDef.ward`) is a consumable: `buy` adds one to
  `Unit.wards` (up to `WARD.carry`) and takes no bag slot. `useActive(..., 'ward', aim)` calls
  `plantWard`, which spawns a `'ward'` unit (`spawnWard` in `state.ts`) within `WARD.range` of the
  champion, with `hp` `WARD.hits` and `expiresAt` `WARD.ms` from now. A ward gives its team
  `SIGHT.ward` of sight (`sightOf`, `viewers`) and `updateVision` lets it see champions in a bush
  within that sight. `damage` takes exactly one hit off a ward whatever the amount; projectiles and
  zones skip wards; `kill` pays `WARD.gold` to a champion killer and notices blue's losses. Dead and
  burnt-out wards are dropped each tick like dead minions. AI champions (`aiWard`) plant a carried
  ward at the first `WARD_SPOTS` entry (and from `WARD_AI.bushesFrom` the first bush, LB26) within
  `WARD_AI.reach` that has no live ward of their team within `WARD_AI.taken`, and in `aiAct` knock down an enemy ward within 220 px when nothing else is
  in reach. The view draws wards with the Graphics (`drawWard`: stake, gem eye, hit pips, and blue's
  sight ring), not a baked sheet, and as diamonds on the minimap.
- Recall (LB7, round 2): `startRecall` sets `Unit.recallMs` to `RECALL.ms` (and `lastRecallAt`);
  `updateUnit` counts it down and `finishRecall` moves the champion to its spawn point (its lane
  walk restarts at `wp` 1). `damage` on a champion, `commandMove`, `commandAttack`, `cast` and
  `useActive` (planting a ward included) zero `recallMs`; `playerAct` and `championPlan` stand still while it runs, and `free`
  keeps a recalling champion off team plans. The player recalls with T or the top bar's
  `RECALL_BUTTON` (`drawRecallButton`), which fills as the channel runs; a bar and "Recalling" show
  under any recalling champion's health bar. AI champions recall (in `championPlan`) when free of
  enemies within `RECALL.aiLook`, far from home, at most every `RECALL.aiEvery`, and either under
  `RECALL.aiLow` health or carrying `RECALL.rich` gold with a `nextBuy` to spend it on; at home they
  wait at the fountain until 90% health.
- Kill streak bounties (LB8, round 2): `Unit.killStreak` counts champion kills since the last
  death (`kill` raises the killer's, zeroes the victim's). `bountyOf(killStreak)` (`BOUNTY`) is the
  gold a slayer gets on top of `KILL.gold`; notices and `aiLog` say when a streak sets a bounty and
  when one is claimed. `updateGanks` sorts prey by bounty before health and runs every
  `GANK.every / 2` while any living champion carries one. The view puts a gold "BOUNTY" label over
  the champion's bar (`drawBar`).
- AI shopping (LB9, round 2): `aiShop` runs for every AI champion each tick it is dead or `atShop`:
  it buys `nextBuy(u)`, the first item of `AI_BUILDS[AI_BUILD_FOR[role] ?? 'fighter']` not owned
  and not a part of an owned item, when it can pay (the build order is kept, so gold is saved for
  the next item); with the build done, an elixir (`AI_ELIXIR` by build: tank Iron, fighter Wrath,
  caster Swift) when it has none and `ELIXIR.aiSpare` gold over its price; and whenever it buys
  neither (the next build item is not paid for yet, or the build is done), a ward when it carries
  none. So at 0:00 every AI champion buys the Healing Flask and, unable to pay the next item, a
  ward at once. Every build starts with the Healing Flask, which
  `aiAct` drinks under 40% health. `aiLog` reports each purchase.
- Buy back (LB10, round 2): `buyBack` lets a dead champion pay `buybackCost` (`BUYBACK.base` plus
  `perLevel` per level) to `revive` at once, then sets `buybackReadyAt` `BUYBACK.cd` ahead. The
  player uses X or the top bar button, which shows the cost or the time until it is allowed again
  while dead. `aiBuyBack` runs for dead AI champions: they buy back with at least 3 s left to wait
  when an enemy champion stands within `BUYBACK.aiThreat` of their Nexus.
- Inhibitors (LB5): warded (no damage, not targeted, a ring and a grey bar) while a tower of their
  team and lane stands (`invulnerable`); a Nexus is warded while all three of its inhibitors stand.
  A fallen inhibitor stays down (drawn as small rubble) and makes `spawnWave` give the other team's
  minions on that lane `power` `SUPER_MINION` (1.6x health and damage, drawn 1.5x with a gold ring).
- The guardian beast (LB1): one `'beast'` unit (`s.beast`), neutral, asleep (dead) until
  `BEAST.firstAt` (90 s) and `BEAST.respawnMs` after each fall. `beastAct` claws the unit that hit
  it last plus anyone within `BEAST.splash` of it, throws a neutral projectile at one out of reach,
  forgets an attacker past `BEAST.leash` and heals while nobody fights it. Its slayer's team gets
  `beastBuff[team]` for 90 s: its minions deal 1.5x and take 0.65x (`attack`, `takenMult`), drawn
  with a violet glow, with a chip per team at the top right (`buffChip`).
- The elder beast (#291): from `ELDER.at` (14:00) the beast turns into the Elder Guardian for good
  (`s.beastElder`, `makeElder`: `ELDER.hpMult` health and `ELDER.dmgMult` damage), when it wakes or,
  if awake, the first tick nobody is fighting it at full health. Its slayer's team gets the usual
  rewards plus `ELDER.gold` and `elderBuff[team]` for `ELDER.buffMs` (60 s): in `damage`, that
  team's champions (`elderBlessed`) deal `ELDER.structMult` to towers, inhibitors and the Nexus, and
  an enemy champion they leave under `ELDER.execute` of its health dies. The view draws it from
  its own sheet (`ELDER_KEY`, `beastModel(pose, true)` with gold crystals, baked by `bakeElder` the
  first time it shows) at 1.12 scale, and a gold chip per blessed team under the violet ones.
- Bushes (LB2): `updateVision` hides enemy champions in a bush (`bushAt`) that no unit of that team
  sees in the same bush or within `BUSH_REVEAL`. `nearest`,
  the player's target, AI ganks and clicks skip hidden units; the view draws no sprite, bar, marker
  or minimap dot for red champions hidden from blue and draws blue champions in a bush at 0.6
  alpha. Attacking or casting sets `revealMs` (1.5 s), which shows the champion.
- AI for allies and red: attack the nearest visible champion, then minion, then vulnerable structure
  in reach, cast abilities (with their upgrades) when they have a use, otherwise walk the lane.
  Before that, `championPlan` (LB3): fall back to the nearest own tower behind (`fallbackPoint`) for
  `RETREAT.ms` when low or outnumbered by two, calling allies near by with it; go for the beast if
  picked as one of its team's two `contesters` (`updateContesters`); walk to a `gankTarget` set by
  `updateGanks` (every 70 s from 100 s, `GANK.night` times that at night, per team: the weakest
  visible enemy champion, hunted by the nearest healthy AI champion more than 550 px away). On the
  way, `ambushBush` (LB26, `AMBUSH`) picks a bush within `AMBUSH.reach` of the prey but farther than
  `AMBUSH.strike`, nearer the hunter than the prey is; the hunter walks into it and waits
  (`Unit.ambushBush`, `ambushUntil`) until the prey comes within `AMBUSH.strike` or `AMBUSH.waitMs`
  passes, then charges (once per gank: `ambushUntil` is set to Infinity, and `updateGanks` resets
  both). AI champions take upgrades on level up
  (`aiRate` picks). AI champions with reach kite melee ones (`KITE`), cast an escape when they
  fall back, keep R for champions and the beast, and from 2:00 every `JUNGLE.every` each team sends
  one free champion for a brute's buff on its half or a watchstone it lacks (`updateJungle`).
  Towers shoot a champion with `aggroMs` (it hurt an enemy champion in the last `TOWER.aggroMs`)
  first, then minions, then any champion.
- Watch AI (`?watch`, `shared/watch.ts`): `GameScene.watchMatch` skips the pick screen and calls
  `createGame(random, 1, { watch: true })`, which spawns blue's fifth champion as an AI one
  (`player` false, lane `top`, still `s.player` so the camera and HUD follow it) and sets
  `s.watch`, which stops `updateObjective`. The scene adds `frameMs * watchSteps()` to its step
  accumulator, draws with no fog (`hidden` and `updateFog`), ignores keys and clicks but the end
  screen's Watch another, and hides the objective card and marker. `aiLog` in `sim.ts` reports
  ganks, jungle trips, outnumbered retreats, AI upgrades, kills, the beast, towers, inhibitors and
  watchstones, keyed by team.
- Notices (`s.notices`, `notice` in `sim.ts`): the beast waking or falling, an inhibitor falling,
  ganks, champion kills ("X slew Y"), brute buffs taken by blue and watchstones taken; the newest shows for 4 s in a strip under the top bar.
- Match objectives: one goal at a time for the player's team (`OBJECTIVES`, in turn): topple the red
  tower nearest the blue Nexus (150 s, 200 gold and the siege banner: the player's champion deals
  +25% to towers and the Nexus for 60 s), clear the boar or wolf pack nearest the player on blue's half (`ownHalf`) (90 s, 120 gold), defeat
  the red champion nearest the player (120 s, 150 gold), slay the guardian beast (120 s, 250 gold;
  done only when blue slew it, read from `beastBuff.blue`, and missed at once when red slays it; skipped
  while it sleeps). The goal is done when its target is dead, however it fell (a wolf pack's goal
  moves from the alpha to a pup still up, so the whole pack has to fall); when its time runs out it is missed. The next one
  starts 4 s later. A card under the top bar shows it (title, time left, the target's damage as a
  bar, the reward), a gold pill and dashed ring mark the target in the world and a star marks it on
  the minimap. While the target is hidden from blue, the marker and the star go and the card's bar
  keeps the damage last seen (`objSeen`, reset by `startMatch` since unit ids repeat each match).
- Upgrade choice on level-up: levels 2, 3, 4, 5 and 7 (`UPGRADE_LEVELS`) of the player's champion
  each queue an offer of two upgrades (`upgradePairAt(champion, level)`, the matching pair in
  `UPGRADES`); two cards in the bottom bar (between the shop button
  and the minimap) show the first offer, and the ability box an option changes gets a gold diamond.
  Clicking a card or pressing 1, 2 or 3 keeps it. Upgrades scale an ability's radius, damage, range,
  heal, shield or cooldown by a percent, add a stun or a slow, or add bolts (`abilityFor` applies
  them). Levels 6 and 8 (`ULT_RANK_LEVELS`) offer nothing but rank up the R instead: each rank adds
  `ULT_RANK` (+20% damage, heal and shield, -15% cooldown), applied in `abilityFor` through
  `ultRank(level)`, with a notice for the player. Gold pips under an ability box count its upgrades
  and, on R, its ranks; the upgrade panel names what the next level brings. AI champions pick theirs
  on their own.
- Class mastery (#292): `mastery.ts` keeps the player's wins per class under the save key
  `lane-brawl-mastery` (`loadMastery`, `recordWin`; JSON `{ classId: wins }`, every read and write
  in try/catch). `masteryRank` turns wins into a rank by `MASTERY_WINS` (1, 2, 4, 6, 9 wins for
  ranks 1 to 5). `startMatch` passes the picked class's rank to `createGame` (`MatchOptions.mastery`,
  `s.mastery`; always 0 when watching), and `gainXp` offers the player `offerFor(class, level,
  owned, 3)` at the first `s.mastery` of `UPGRADE_LEVELS`, else 2: the level's pair less what it
  owns, topped up from its other pairs, later ones first. `UpgradeOffer.options` is two or three
  ids; three show as slimmer cards (`upgradeCard(i, 3)`), the third with a gold edge, kept with 3.
  Once one is kept, `chooseUpgrade` draws the offers still queued again with `offerFor`, so a card
  borrowed from a later level never shows twice.
  The end panel counts a win once (`winCounted`) and shows the rank and the wins to the next; pick
  cards show one gold diamond per rank. The playthrough starts with no save, so it sees pairs.
- Last hits: after every tick the enemy minion within the player's reach plus 140 px that its next
  hit would kill is `lastHitMark` and gets a gold outline. A last hit by the player grows the streak
  (`streak`, shown in a chip by the gold counter) and pops a coin fx with the gold; from x4 on it
  pays +25% (24 gold). The streak resets when the marked minion dies to anyone else.
- Healing at home: a champion within `FOUNTAIN.radius` of its own Nexus (`atFountain`) heals
  `FOUNTAIN.share` of its max health a second (`updateUnit`). The view draws the ring round both
  Nexuses (`drawFountains`) and green motes over a champion healing there.
- Skill looks (`scenes/skillFx.ts`): every ability has its own animation, keyed by its look
  `${championId}.${key}` (`lookOf` in `sim.ts`). `cast` raises one `'skill'` fx per cast (where it
  lands, where the caster stood, the radius and facing); bolts carry `look` and raise
  `${look}>hit` where they strike; zones carry `look`; buffs from abilities carry `look` and glow
  with an aura (`drawAura`) instead of the plain ring. `LOOKS` holds each cast's draw function and
  how long it lasts, `drawProjectile` each bolt's shape, `drawZone` each zone's churn; anything
  without a look (towers, the beast, jungle buffs) keeps the plain shapes. Scatter comes from
  `hash`, never `Math.random`.
- Range indicators (`drawRanges`): a dashed ring round the player's champion at its attack `range`,
  one round a champion under the cursor, and while an ability's key is held (`aiming`) or its box is
  hovered (`hoverAbility`), its range ring and shape on the ground (an area circle, a bolt's lane
  per bolt, a dash's line and landing), grey while it can't be cast. Holding a key aims; letting go
  casts at the cursor (`release`); Esc drops the aim. `lastWorld` is re-read from the pointer every
  frame, as the camera moves under it.
- Player input: click the ground to walk, click an enemy to attack it, hold Q/W/E/R to aim and let go
  to cast at the cursor,
  D/H use item actives at the cursor, B or the Shop button opens the shop, Esc closes it (and the scoreboard), Tab held shows the scoreboard, 1, 2 and 3
  pick an upgrade (3 for mastery's third card). Clicking a watchstone walks to it rather than
  attacking it. Standing still auto-attacks the nearest enemy. The shop closes when a Nexus falls.
- HUD (bevelled slate panels with gold trim, system font): gold with the streak chip, the Nexus
  health and the clock in the top bar; the objective card under it (hidden while the shop is open)
  and a siege banner chip when it is up; at the bottom the champion's figure, health, XP, items,
  respawn timer and last hits, the four ability boxes with cooldowns, the shop button, the upgrade
  cards (or the upgrades taken) and a minimap.
- Scoreboard and assists (LB12): `damage` notes in the victim's `hurtBy` (id to game time) every
  enemy champion that hurts a champion; `kill` gives every one of them other than the slayer, hit
  within `ASSIST.windowMs`, an assist (`Unit.assists`) and `ASSIST.gold`, whoever landed the blow
  (a tower or minion too), then clears `hurtBy`; a player's assist pops a blue coin fx. `Unit.cs`
  counts every champion's minion and camp kills (the player's own `s.lastHits` stays as it was, for
  the streak and the end panel). The top bar shows the team kill score in `SCORE_CHIP`, left of the
  clock; holding Tab (`keys.TAB`, also in watch mode) or tapping the chip (`scoreTapped`, closed by
  another tap, Esc, the panel or the shop) shows `drawScoreboard` in `SCORE_PANEL` (where the shop
  sits; it replaces the shop and hides the objective card, buffs and notice while it shows): per
  team, each champion's class colour, name and class, level, K / D / A, last hits, items and its
  respawn timer or bounty. The bottom bar's score line reads `K/D/A` plus the player's last hits.
- River runes (LB13): `updateRunes` (in `tick`) fills `s.runes` (one per `RUNE.spots`, on the
  river between the watchstones) every `RUNE.every` from `RUNE.firstAt`, the kinds by
  `RUNE_ORDER[(s.runeRounds + i * 2) % 4]` (no `Math.random`), replacing any left, with a notice and
  the `rune` sound. The first living champion within `RUNE.pick` takes one: `RUNES[kind]` gives a
  `buff` for `ms` (its id is the rune's name key, so the buff strip names it) or `gold` plus
  `teamGold` to each teammate, with a ring fx, the `runeTaken` sound and a notice (red's only when
  blue sees the taker). In `championPlan`, after the lane fight check and before the beast,
  `runeFor` sends an AI champion to a rune within `RUNE.aiReach` when it has `RUNE.aiMinHp` of its
  health and no AI teammate is nearer. The view draws the stone rings always and a hovering hexagon
  gem with the kind's mark (`drawRunes`, bobbing unless motion is reduced) and a minimap dot while
  the spot is out of the fog.
- Mercenary camps (LB14): `MERC.spots` holds two camps (blue's half by the bottom lane, its mirror
  by the top lane); `createGame` spawns `MERC.count` `'merc'` camps at each, one `group`, after the
  champions so every older unit keeps its id. When `kill` fells the last living one of a group to a
  champion, `spawnMercs` (`state.ts`) gives the slayer's team `MERC.count` minions at the camp
  with `power` `MERC.power` (drawn as super minions), on a path from the camp to the end of the
  nearest stretch of `laneNear`'s lane and on to the enemy Nexus, with a notice, a ring and the
  `mercs` sound. `updateJungle` counts a band's leader on a team's own half as a goal alongside the
  brutes. The sellsword is `mercModel` (`models.ts`, a minion's figure in tan with a kettle hat and
  a broad blade, scaled 0.78), baked as `MERC_KEY` in `MERC_CELL`; `map.ts` paints the camps'
  clearings (`CLEARINGS`) with a fire pit and two tents.
- Battle spells (LB15): `SPELLS` (`blink`, `firebrand`, `mend`, `barrier`, `teleport`) in `data.ts`; every
  champion has `Unit.spell` (from `aiSpellFor(role)` in `spawnChampion`; the player's from
  `MatchOptions.spell` unless watching) and `spellCd`, counted down in `countDown`. `castSpell(s, u,
  aim)` in `sim.ts` casts it: Blink moves like Phase Boots, Firebrand `damage`s (through `dealt`)
  the visible enemy champion nearest the aim within `range` and `aim`, Mend heals the caster and the
  most hurt ally within `range`, Barrier sets `shield`/`shieldMs`; amounts are `base + perLevel *
  level`. `aiSpell` (called in `aiAct` before `championPlan`) uses it from `SPELL_AI.from` (100 s, so
  the first round plays as tuned), when under `SPELL_AI.low` with an enemy champion within
  `SPELL_AI.look` (Blink toward `fallbackPoint`), Mend also for a low ally, Firebrand on a champion
  it can finish. The player casts with G or `SPELL_BUTTON` (`drawSpellButton`, right of the recall
  button, filling as it cools down); the pick screen's `SPELL_PICK` button steps through the
  spells (`nextSpell`), and hovering it shows the spell's name and text in the champion lines. The
  pick is kept under the save key `lane-brawl-spell` (`game/spellChoice.ts`: `loadSpell`,
  `saveSpell`, in try/catch). The pick button is one text, replacing a hint line, because every
  Phaser text draws `Math.random` for its texture key and the playthrough's seeded roster depends
  on how many draws come before the shuffle.
- Teleport (LB24): the fifth spell rides on the recall channel. `castSpell` picks the allied tower
  or minion `closest` to the aim within `aim`, and sets `recallMs` and `recallFull` to its `ms` and
  `Unit.portTo` to that unit's id (a recall sets `recallFull` to `RECALL.ms` and `portTo` to 0), so
  everything that breaks a recall breaks it too. When the channel runs out `finishRecall` hands it
  to `finishTeleport`, which `place`s the champion `TELEPORT_GAP` from its target toward home, or
  says the teleport is lost if the target has fallen. The bar under the champion and the recall
  button take the spell's colour and read Teleporting. No AI champion carries it.
- Pings (LB16): `PINGS`, `PING_KINDS` (`attack`, `gather`, `danger`) and `PING` in `data.ts`.
  `sendPing(s, u, kind, at)` in `sim.ts` (refused within `PING.cd` of the last, `s.lastPingAt`)
  pushes a `Ping` to `s.pings` (dropped after `PING.showMs` in `tick`) and gives the AI allies an
  errand: `attack` sends the `PING.answer` nearest ready allies within `PING.reach`, `gather` the
  ready ones within `PING.near`, setting `Unit.pingGoal`, `pingTarget` (the visible enemy within
  its radius plus `PING.pick` of the point, for `attack`) and `pingUntil` (`PING.ms`); `danger`
  sets `retreatUntil` for the allies within `PING.near` and drops their plans. In `championPlan`
  the errand comes after falling back and before runes: hit the marked enemy (unless it is
  warded), else walk to the point and wait there while no enemy champion is near; an errand
  blocks recalls and `free`, so ganks, the beast and the jungle leave the champion alone. A ping
  of the player's makes a notice naming the allies who answer (`noticePing*`). Blue's AI calling a
  retreat when outnumbered pushes a `danger` ping (shown only, no errand). The view: Z, N, C at
  the cursor, Alt and a click (`attack`), or `pingButton(i)` (`PING_BUTTONS`, a column between
  the upgrade panel and the minimap) to arm `pingArmed` for the next press on the map;
  `drawPings` draws blue's pings in the world (a pulsing ring, still under reduced motion, and
  `pingSign`), and the minimap rings them.
- Death recap (LB17): `damage` takes a `how` (`HitHow`: `'attack'`, the default, an ability key or
  `'spell'`; abilities pass their key through `abilityHit`, bolts and zones through `hitHowOf`
  their `look`) and, for the player's champion, pushes each hit's health lost to `s.playerHits`
  (kept for `RECAP.windowMs`). `kill` turns them into `s.recap` (`deathRecap`: summed by attacker
  and `how`, all minions as one row with `src` -1, the biggest `RECAP.rows`). `drawRecap` shows it
  under the notice while the player's champion is dead (not watching, not over the shop or
  scoreboard), naming champions by first name and the rest by kind (`recapName`).
- River drakes (LB18): `DRAKE`, `DRAKES`, `DRAKE_ORDER` and `DrakeElement` in `data.ts`; the drake
  is a camp of kind `drake` (`CAMP_KINDS.drake`), spawned last in `createGame` (so other ids stay)
  dead with `respawnAt` `DRAKE.firstAt`, its id in `s.drake`; `s.drakeElement` is the element of
  the one asleep or awake, `s.drakeRounds` counts the slain. `kill` calls `slayDrake`: the next
  element comes up, and below `DRAKE.soul` stacks the slayer's team pushes the element to
  `s.drakeStacks[team]` and every one of its champions gets the summed `bonus`es (doubled at the
  soul) as `Unit.drake`, which `buffSum` counts in with the buffs. Waking (in `updateUnit`) and each
  slaying make a notice and a sound (`drakeWakes`, `drake`). `updateJungle` sends up to `DRAKE.ai`
  free champions of a team without the soul at an awake drake before anything else. The view:
  `drakeModel(element)` in `models.ts`, baked lazily per element (`bakeDrake`, `drakeKey`,
  `DRAKE_CELL`); the pit is painted by `pit` in `map.ts` (shared with the beast's); the minimap dot
  takes the element's colour and `drawBuffs` adds a chip per team with stacks.
- Early gold (LB19): `FIRST_BLOOD` and `PLATING` in `data.ts`. `kill` pays the first champion
  kill of the match (`s.firstBlood`) `FIRST_BLOOD.gold` more, with a notice and the `firstBlood`
  sound. `createGame` gives each outer tower (the one of its team and lane farther from its Nexus)
  `Unit.plates` = `PLATING.count`; `damage` calls `breakPlates` while `s.time < PLATING.until`,
  which drops a plate for every share of health lost and splits `PLATING.gold` between the enemy
  champions within `PLATING.share`. `tick` clears all plates at `PLATING.until` (`s.platesGone`,
  with a notice). `drawBar` shows the plates as gold pips over a tower's bar.
- Bodies, forest and paths (LB20): `game/terrain.ts` holds what walkers can't walk through.
  The forest: everything that is not open ground (`openGround`: a lane within `LANE_WALK`, the
  river, both bases, the clearings, pits, ruins and bushes, and `PATH_HALF` either side of a path)
  is forest. `JUNGLE_PATHS` are written for the quarter between the top lane, the river and the
  mid lane (`WEST_PATHS`, first-layout coordinates), turned over the mid lane for the bottom
  lane's quarter (`turn`) and mirrored for red's. `TERRAIN` builds a 10 px grid of it and a
  signed distance field (`signedField`, two exact distance transforms): `clearance(p)` is how far
  `p` is from the forest, negative inside. It then flood-fills from the blue Nexus (`reached`) and
  gives any place in `PLACES` (camps, bushes, ruins, pits, runes, ward spots) a champion could not
  reach one straight extra path to the nearest reached cell; `PATHS` holds the written paths plus
  those (none today). On top stand the solid circles, `OBSTACLES`: the ruins' pillars
  (`ruinPieces`), the stones round both pits (`pitStones`), towers, inhibitors, Nexuses and
  watchstones, sized by `SOLID`, in a 100 px grid. `SCENERY` (pines and rocks, art only) fills the
  forest from 14 px in, so trees stand behind the walls and line the paths.
  `moveToward` in `sim.ts` heads for `nextStop`: the goal itself when `clearLine` shows no forest in
  between, else the next point of `route` (A* over a 25 px grid of cells the walker's `bodyOf` fits
  in, then pulled tight with `clearLine`), kept per unit in `ROUTES` and found again when the goal
  moves 40 px or every 2 s. A goal in the forest ends at the nearest cell that fits. It then takes
  a `steer` step: straight on, or along the edge of the obstacle or forest in the way, on the
  goal's side. After the units' turns `tick` calls `separate`: overlapping living champions and
  minions are pushed apart by `BODY.give` of the overlap, camps and the beast push them off
  themselves, and `settle` puts every walker back out of the forest (along the field's slope,
  `outward`) and the obstacles. Dashes, blinks, knocks and pulls go through `place`, which settles
  the landing. `commandMove` settles the clicked point too, and the player's champion stops when it
  got no closer for `STUCK.ms` within `STUCK.near` of it (`moveStuckMs`, `lastMoveDist`), so a crowd
  on the spot doesn't hold it walking. The forest stops walking only, not bolts or sight. In
  `map.ts`, `forest` darkens the forest floor, `trails` paints the paths, `laneWalls` lays stone
  blocks on the forest's edge within 34 px of a lane's walkable band (so the walls break where a
  path comes out) and `scenery` the trees; the minimap draws `PATHS` as thin tan lines.
- Day and night (LB21): `DAYNIGHT` in `data.ts`. `nightness(time)` in `sim.ts` is 0 by day, 1 at
  full night and ramps over `DAYNIGHT.fade` at dusk and dawn; `sightOf` scales champion sight by it
  down to `DAYNIGHT.sight`, so `viewers` (the rules' vision and the view's fog) both
  follow it. `tick` flips `s.night` at half dark with a notice and the `nightfall` or `daybreak`
  sound. The view lays a blue tint (`NIGHT_ALPHA`) over the world in `fogG`, under the fog, and
  `drawSky` draws a sun or moon beside the clock. The first night falls at 2:50, after the
  playthrough's first round.
- Quick match (LB22): `QUICK` in `data.ts`, `MatchOptions.quick` and `GameState.quick` and
  `lanes` (all three, or `QUICK.lanes`). `createGame` makes towers and inhibitors only on
  `s.lanes`, with `QUICK.hp` times their health (the Nexuses too), `QUICK.allies` and
  `QUICK.enemies` champions all on the open lane, and calls `openLanes` in `terrain.ts` so the
  closed lanes' tower and inhibitor spots don't stand in the way. `spawnWave` sends minions only
  down `s.lanes`, and `spawnMercs` takes the nearest open lane (`laneNear(p, lanes)`). On the pick
  screen `MODE_PICK` switches it (`hoverMode` shows what each means), kept under the save key
  `lane-brawl-quick` (`loadQuick`, `saveQuick` in `game/spellChoice.ts`); the two hint lines share
  one text so the pick screen makes as many texts (and Math.random draws) as before. The minimap
  draws closed lanes faint. Watched quick matches end in 4 to 18 minutes, most near 8 to 12.
- Comeback and surrender (LB23): `COMEBACK` and `SURRENDER` in `data.ts`. `behind(s, team, gap)`
  in `sim.ts` compares the teams' summed champion XP; `kill` pays a champion kill of a team behind
  by `COMEBACK.gap` `COMEBACK.gold` and `COMEBACK.xp` more (a notice and the `comeback` sound for
  the player), and `drawBuffs` shows a chip while blue is behind. `callSurrender` (the scoreboard's
  `surrenderButton`, from `s.voteReadyAt`) counts the player's yes and each ally's `votesYes`
  (behind by `COMEBACK.gap`, or `SURRENDER.structs` more towers and inhibitors lost); at
  `SURRENDER.pass` the team gives up (`surrender`: `s.surrendered`, the phase and winner as if
  the Nexus fell), else a notice, and the next vote waits `SURRENDER.cd`. `updateSurrender` lets
  an AI team (red, both when watching) give up every `SURRENDER.cd` from `s.nextSurrender` when it
  is `SURRENDER.aiGap` behind on XP and `SURRENDER.structs` behind on structures. The end panel
  says who surrendered.
- Match summary (LB25): `SUMMARY` in `data.ts`. `tick` calls `sampleWorth` every `SUMMARY.every`
  (and `kill` of a Nexus and `surrender` once more at the end), which pushes both teams' `netWorth`
  (gold plus the full `cost` of each held item) onto `s.history`. `mvpOf` picks the champion with
  the best `SUMMARY` score. The end panel (`END_PANEL`, now 560x420) shows them in `drawSummary`:
  the MVP line in its team's colour and a line per team in `WORTH_GRAPH`, scaled to the top value.
- Victory and defeat panel with the match's objectives, last hits, best streak and beasts slain,
  and "Play again".

Missing or rough:

- Paths are found round the forest only; towers, pillars and stones are slid round one step at a
  time (`steer`), which their spacing keeps clear of pockets.
- No title screen of its own. The only saves are class mastery and the battle spell (below).
- Bushes hide champions only, not minions. The camera follows the player's champion.
- AI champions use bushes only to wait in on a gank, and ward only the fixed `WARD_SPOTS` and bush
  centres.
- Balance is tuned with AI-only matches (every class within roughly 35% to 65% wins over 80
  matches); the player's own champion is not part of that.
- Only the first round (see the playthrough) is covered by the test; the Warden is the only champion
  the test plays.
- No tower order within a lane; inhibitors don't come back.
- Sprites face eight directions; a unit turning between them snaps.

## Architecture

File map (`src/`):

- `howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English (which US English shares) and German, picked with `byLanguage` and handed to
  `setupGame(game, { howToPlay })` in `main.ts`; update both when the controls or the first round
  change.
- `i18n.ts` and `i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British English
  source (grouped: roles, champions, abilities, upgrades, items, jungle, then the HUD, notices,
  shop and end panel), `i18n/de.ts` the German (with `keepEnglish`: the champions' own names and
  texts made only of placeholders) and `i18n/en-US.ts` only the texts spelled differently ("armor").
  `t(key, vars)` shows a text in the hub's language, `TextKey` types the keys and `english(key)`
  gives the English for the watch log. Every text on screen goes through `t`, and a new one gets its
  German entry (and a US one if its spelling differs) in the same PR.
- `audio.ts`: the song (`SONG`) and the sound table (`sfx`, from `shared/audio.ts`), plus `BUSY`,
  the combat sounds a watched match leaves out. See Sound below.
- `main.ts`: creates the `Phaser.Game` (960x540, `Phaser.Scale.FIT`, smooth scaling) with
  `GameScene` only, calls `setupGame(game)` from `shared/setupGame.ts` and
  `setupScaling(game, { fill: true })` from `shared/scaling.ts`, and in dev builds puts `game` on
  `window`.
- `scenes/GameScene.ts`: the pick screen, the match view and input. `create` bakes the art
  (`bakeUnits`, `paintMap`), shows the map as 400 px tiles (only the ones in view are drawn) and
  keeps one image per unit (figure, gold outline, additive hit flash), depth-sorted by the feet's y.
  Each frame it runs `tick` in fixed 16 ms steps, draws shadows and team rings (`groundG`), places
  the sprites, draws bars, projectiles, effects and the objective marker (`topG`), then the HUD
  (`hudG` plus text objects kept in a map by key; world texts such as coin labels and level badges
  live in the same map).
- `scenes/skillFx.ts`: every ability's look (see "Skill looks" above): `drawSkill`, `skillMs`,
  `drawProjectile`, `drawZone` and `drawAura`, with small shape helpers. No game rules.
- `scenes/layout.ts`: screen rectangles for the bars, the objective card, the streak chip, the
  ability boxes, the upgrade panel and cards (`upgradeCard`), the shop, the kill score and scoreboard (`SCORE_CHIP`, `SCORE_PANEL`), the minimap, the pick cards
  and the end panel, plus `VIEW` (the designed 960x540), `SCREEN` (the view actually shown),
  `FRAME` (the designed rectangle's corner in it), `fitLayout` and `FONT` (a system font stack).
  The rectangles are written for 960x540; `fitLayout(w, h)` moves them once at start for the view
  (see Screens below).
- `art/lowpoly.ts`: the software renderer. 3x4 matrices (`T`, `S`, `Rx`, `Ry`, `Rz`, `chain`,
  `swing`), a `Model` with a transform stack (`at`), primitives (`box` with a taper, `prism`,
  `gem`, `ico`, `slab`) whose faces get outward normals from each primitive's centre, and `render`:
  turn by yaw, cull back faces, Lambert light from the top left (`LIGHT`), painter's sort, fill.
  The toon look snaps the light to three cel bands (`CEL`) and saturates the colours (`SATURATE`);
  `flat` gives the old smooth shading, and `noInk` skips the per-face `INK` stroke (the bake inks
  whole sheets instead). The camera looks down from the south at `ELEVATION` radians. Also `seeded`, the art's own random
  generator.
- `art/models.ts`: every model as a function of a pose. `figure` builds a humanoid (legs or a robe,
  a tunic in the team's cloth, head, arms on shoulder joints) from a `Kit` per class: the Warden's
  helm, hammer and kite shield, the Blade's hood, cape and daggers, the Archer's cap, quiver and
  bow, the Mage's hat and crystal staff, the Priest's halo, cloak and sunburst staff, the
  Berserker's horned helm, fur mantle and great axe, the Harpooner's knit cap, beard, rope and
  harpoon, the Witch's antlered hood, shawl and branch staff, the Stalker's straw hat, scarf, curved
  sword and throwing star, the Lancer's crested helm, pennant spear and banded shield, the
  Gunslinger's wide hat, bandana, duster and revolver, the Automaton's brass head with glowing eyes,
  boiler and piston fists, the Tinker's goggles, storm-coil backpack, spark gun and wrench, the
  Wolfkin's wolf head, mane, tail and claws, and the Bruin's bear head, belly and claws. Champions
  get `hero: true`, which scales the head by `HERO_HEAD` and lifts it by `HERO_LIFT`, and a prop
  from their story: Hald's gate key and gate shield, Vesna's torn sash, Tamsin's leaf cloak, Elowen's
  half-ice crystal, Maren's sun disc, Torvik's wrist chains (`chainLinks`), Morrow's whale tooth,
  Gwyth's moths and moss, Kaida's watchstone charm, Liora's plume and swallow-tail pennant, Rook's
  bandolier, AX-9's aether core, Winnie's lightning rod and copper gauntlets, Fenra's moon mark and
  arm band, and Grumm's oak sapling and honey pot. Also
  `wolfModel`, `bruteModel` (ember or moss), `watchstoneModel` (per side or neutral) and
  `ruinModel`. `classPose`
  gives the joint angles for `idle`, the walk `w0`..`w3`, the attack `a0` (wind-up) and `a1`
  (strike) and the cast `c0`. Also the minion (a scaled soldier with sword and round shield), the
  boar, towers, rubble, the Nexus, an inhibitor (`inhibitorModel`), the guardian beast
  (`beastModel`: a horned quadruped with violet crystals, scaled 2.1), pines, rocks and a coin.
  `TEAM_CLOTH` and `TEAM_GLOW` are the team colours.
- `art/bake.ts`: renders the models into sheets at boot (`bakeUnits`, once): one idle frame per
  class for the pick cards and portrait (`pickKey`), the minions, the boar, wolf, brutes,
  watchstones and the beast (8 directions x 8 poses each), a gold silhouette
  of the red minion sheet for the last-hit outline, towers, inhibitors, the Nexus, rubble and the
  coin. The champions' full sheets (both teams' cloth) are baked when a match starts, only for
  the classes in it (`bakeChampions`, kept for later matches). Frames are named `${dir}:${pose}` (`frameName`); dir 0 faces right and each step turns 45
  degrees clockwise on screen (`dirFor` maps a facing angle). Each sheet gets its ink outline in
  one pass (`inkOutline`: its silhouette in `INK`, drawn under it at eight small offsets), much
  cheaper than stroking every face. `CHAMP_CELL` is 76x98 to fit the hero heads and props. Sheets render at `RES` and are
  drawn at 1/RES: 2 on a screen that needs no scaling, up to 3 on a big or dense one (`sharpRes`
  in half steps, held to what the beast's sheet can load). Pick cards and the portrait scale by
  `0.85 / RES` and `1.2 / RES`; each `*_CELL` gives a frame's size and where the feet sit.
- `art/map.ts`: `paintMap` paints the world once on one canvas (`MAP_KEY`), `MAP_RES` canvas pixels
  per world pixel (1, up to about 1.7 on big screens; the tiles are sized back with
  `setDisplaySize`): faceted grass, flagstone
  lanes clipped to the lane band, kerb rocks, paved plazas with a team ring round each Nexus, dirt
  the river (faceted water, banks and glints), clearings for the camps (a glowing ring for the
  brutes, bones for the wolves), watchstone islands, ruins, flowers and mushrooms and up to 620
  pines and rocks, from a fixed seed; then the beast's pit and the bushes (tall faceted grass).
- `game/names.ts`: `shortName`, a champion's first name from its full name.
- `game/spellChoice.ts`: the player's battle spell and match kind, the save keys `lane-brawl-spell` (`loadSpell`, `saveSpell`) and `lane-brawl-quick` (`loadQuick`, `saveQuick`).
- `game/mastery.ts`: class mastery, the save key `lane-brawl-mastery` (`loadMastery`, `recordWin`,
  `masteryRank`).
- `game/terrain.ts`: the map's forest and paths (`JUNGLE_PATHS`, `PATHS`, `clearance`, `route`, `clearLine`), its obstacles (`SCENERY`, `OBSTACLES`, `SOLID`) and `steer`, `settle`, `blockedBy`; `art/map.ts` takes the lane and clearing helpers, the paths, the field and the scenery from it.
- `game/data.ts`: plain data, with text keys for names and texts. `MAP_SCALE`, `at`, `WORLD`, `LANES`, `BASE`, `TOWERS`, `RIVER`, `CAMPS`, `CAMP_KINDS`,
  `PUPS`, `SIGHT`, `WATCHSTONES`, `WATCH`, `BUFFS`, `JUNGLE`, `KITE`, the balance constants (`TOWER`,
  `CAMP`, `MINION`, `KILL`, `XP_FOR_LEVEL`, respawn times), `CHAMPIONS` with their `AbilityDef`s,
  `ITEMS`, `ALLY_LANES`, `ENEMY_LANES`, `SIDE_COLOR`, and the loop's data: `OBJECTIVES`,
  `OBJECTIVE_GAP_MS`, `SIEGE`, `UPGRADES` (with `upgradeById`), `STREAK` and `LAST_HIT_LOOK`, plus
  `ACTIVES`, `MAX_ITEMS`, `BEAST`, `BEAST_BUFF`, `ELDER`, `BEAST_CONTESTERS`, `INHIBITORS`, `INHIBITOR`,
  `SUPER_MINION`, `BUSHES` (with `bushAt`), `BUSH_REVEAL`, `REVEAL_MS`, `GANK` and `RETREAT`, and
  round 2's `WARD`, `WARD_SPOTS`, `WARD_AI`, `RECALL`, `BUYBACK`, `BOUNTY` (with `bountyOf`),
  `AI_BUILDS` and `AI_BUILD_FOR`, `ASSIST`, `RUNE`, `RUNES` and `RUNE_ORDER`, `MERC`, and `SPELLS`, `spellById`, `aiSpellFor` and `SPELL_AI`.
- `game/state.ts`: the types (`GameState`, `Unit`, `Projectile`, `Fx`, `Objective`,
  `UpgradeOffer`), `createGame`, `spawnWave`, `spawnChampion`, `spawnWard`, `refreshStats` (level
  and items into stats), `pathFor` (red walks lanes backwards), `laneNear` and small helpers. No
  Phaser.
- `game/sim.ts`: the rules: `tick` (vision, watchstones, contesters, ganks, jungle trips, units,
  projectiles, zones), `cast`, `abilityFor`, `viewers`, `stealthed`, buffs (`addBuff`, `buffSum`), `chooseUpgrade`, `buy`, `priceFor`,
  `useActive`, `plantWard`, `startRecall`, `buyBack`, `buybackCost`, `invulnerable`, `hiddenFrom`,
  `commandMove`, `commandAttack`, `damage`, the objectives (`updateObjective`), the last-hit mark
  (`updateLastHitMark`), vision (`updateVision`), the beast (`beastAct`, `updateContesters`), ganks
  (`updateGanks`), and the AI (`championPlan`, `aiShop`, `aiWard`, `aiBuyBack`) and player
  behaviour. No Phaser.

Shared code it imports (outside the game folder): `shared/setupGame.ts` (`setupGame`),
`shared/settings.ts` (`byDifficulty`, `settings`), `shared/scaling.ts` (`setupScaling`,
`sharpRes`, `splitHudCamera`, `viewPoint`), `shared/watch.ts` (`watching`, `watchSteps`,
`mountWatch`, `aiLog`) and `shared/i18n.ts` (`translator`, `byLanguage`, `formatNumber`,
`Translation`).

Screens: `setupScaling` draws the canvas at the screen's resolution (`renderScale` canvas pixels
per game pixel) and zooms every camera to match. `splitHudCamera` gives the scene a second, fixed
camera for everything with a scroll factor of 0 (the HUD, its texts, the pick screen and the
portrait), so the main camera keeps Phaser's middle origin for `setBounds` and `centerOn`. Zones
are hit with `viewPoint(pointer)`; world points come from `worldAt` (the main camera's
`getWorldPoint`, not `pointer.worldX`, which the HUD camera on top would give). `viewRect` is the
part of the world in view this frame (from the camera's `midPoint`, clamped to the world) and
drives the camera follow, the map tiles drawn and the minimap's view box.

The game fills every screen shape (`setupScaling(game, { fill: true })`): the view is 960x540 at
least and grows wider or taller to the screen's shape (up to 1296x540 or 960x720), picked once at
start. `create` calls `fitLayout(viewSize(this))` before anything is drawn, which sets `SCREEN` and
`FRAME` and moves the layout's rectangles: the top and bottom bars span the view's width, the bottom
bar and everything in it (portrait, abilities, shop button, actives, upgrade panel, buff strip) keep
to the bottom edge, the minimap and the buff chips keep to the right edge, the recall button stays
beside the centred clock, and the pick screen, shop panel and end panel stay centred (the pick
screen's texts at `FRAME.y` plus their designed y). The world simply shows more of the map, and
`viewRect`, the pick backdrop, the end screen's dimming and the minimap's view box use `SCREEN`.
Anything new on the HUD uses `SCREEN` and the layout's rectangles, never `VIEW`, and at exactly
960x540 nothing moves (the playthrough clicks there).

State model:

- `GameState.phase` is `'pick'` (the scene's own state; `state` is null there), `'playing'`, `'won'`
  or `'lost'`. `winner` says which team won. `time` is game time in ms.
- `units` holds every Nexus, inhibitor, tower, camp, the beast, champion, minion and ward. Dead
  minions and wards are removed each tick; dead champions, camps and the beast respawn at
  `spawnX`/`spawnY`; towers, inhibitors and Nexuses stay dead (drawn as rubble). A ward keeps
  `expiresAt`. A dead unit's countdowns keep running (`countDown` in `updateUnit`: attack
  cooldown, shield, buffs, and a champion's ability and item cooldowns, aggro and passive gold),
  so a champion respawns with them run down; only a recall needs it alive.
- `Unit.lane` is the lane of a tower, inhibitor, minion or lane champion; `power` a minion's
  super multiplier.
- `sounds` holds the `SoundEvent`s (`SoundId`, an optional world point, `mine` for the player's
  own) raised since the scene last drained them, capped at 64; see Sound.
- `projectiles` are bolts in flight (with an optional `stun`). `fx` holds the visuals raised since
  the scene last drained them: rings, lines, arcs, last-hit `coin`s and abilities' `skill` effects.
- `Unit.side` is `'blue'`, `'red'` or `'neutral'` (camps and the beast). Hostile means a different
  side.
- Champions keep `champ` (the `ChampionDef`), `name`, `level`, `xp`, `gold`, `items`, `cds`
  (cooldowns per key), `cdFull` (each key's last full cooldown, for the HUD's sweep), `upgrades` (ids the player kept), `buffs`, `kills`, `deaths`, and for the
  passives `attackCount` (crits), `lullMs` (ambush) and `hasteMs`. Camps keep `campKind` and
  `group`; watchstones `capture`. Every unit has `hidden` (per team, set by `updateVision`).
- `zones` are the lingering circles of `zone` abilities (side, owner, `dps`, slow, time left). `refreshStats` recomputes `maxHp`, `dmg`, `armor` and
  `speed` from the level and items.
- `stunMs` holds a stunned champion or minion in place (no move, no attack).
- Animation timers: `swing` (180 ms after an attack: wind-up frame then strike frame), `castMs`
  (300 ms after an ability: the cast frame), `flash` (120 ms after a hit), `walk` (distance walked,
  picks the walk frame) and `facing` (radians, picks the direction).
- `Unit.path` and `wp` are a lane walk. The last point of each path is the enemy Nexus.
- A player's champion has `player: true`; `moveTo` is a walk to a point, `target` an enemy to
  attack.
- The loop: `objective` (kind, target unit id, title as `{ key, name? }`, gold, banner, `startAt`, `endsAt`) or null
  between two, `objectiveIndex`, `nextObjectiveAt`, `objectivesDone`, `lastObjective` (how the last
  one ended), `siegeUntil`; `lastHitMark`, `lastHits`, `streak`, `bestStreak`; `upgradeOffers`
  (queued `{ level, options }`, the first one shown).
- The upgrades' state: `beast`, `beastBuff`, `beastKills`, `contesters`, `nextGank`, `nextJungle`,
  `notices`; per AI champion `retreatUntil`, `gankTarget`, `gankUntil`, `jungleTarget`,
  `jungleUntil`; per champion `revealMs`, `aggroMs`, `activeCds`, and round 2's `killStreak`,
  `wards`, `recallMs`, `lastRecallAt` and `buybackReadyAt`, and the scoreboard's `assists`, `cs` and `hurtBy`; the game's `runes`, `nextRune` and `runeRounds`.

How it runs:

- `update` adds the frame's own clock time (`game.loop.rawDelta`, at most 250 ms) to an accumulator
  and runs `tick(s, 16)` for each whole step; the camera and the effects age on the same time.
  Phaser's smoothed `delta` is not used: Phaser clamps it for 120 frames after boot, so how long the
  page took to load would change how fast a match starts and where the camera is. Then it drains
  `fx`, follows the player's champion with the camera, draws the world and HUD, and refreshes the
  zones.
- `tick` spawns waves, updates vision, the beast's contesters and ganks, updates every unit
  (cooldowns, slows, stuns, shields, gold, then the unit's behaviour), resolves projectiles, drops
  dead minions, then settles or starts the objective and recomputes the last-hit mark. A Nexus
  falling ends the match.
- Sprite frames: `castMs` shows `c0`, a swing shows `a0` then `a1`, a unit whose `walk` changed in
  the last 120 ms of game time shows `w0`..`w3` by distance walked, otherwise `idle`. Feet are drawn
  `FOOT[kind]` px below the hitbox centre; hitboxes (`radius`) are unchanged by the art.
- Input: `onPointerDown` checks the zones newest first (shop rows and upgrade cards before the
  bars, which block, and the objective card, which also blocks while it shows, not while the shop hides it; the D, H and V buttons sit in the
  bottom bar, the Recall/Buy back button in the top bar). Anything else is a world click: a
  hostile unit under the cursor (not a watchstone, which can't be hit) becomes the player's target,
  otherwise the point becomes a move.
  A world touch (`pointer.wasTouch`, never the mouse) also starts `stick` (view pixels); dragged
  past `STICK.drag` it goes `live` and `steer` calls `commandMove` each frame for a point
  `STICK.ahead` px from the champion the way knob minus base points (nothing inside `STICK.dead`;
  the base is dragged along past `STICK.r`). Letting go of a live stick stops the champion where
  it stands (`endStick`, on `pointerup` or `pointerupoutside`); `steer` also ends a stick whose
  pointer is no longer down, as a release while the scene was paused is never heard. `addPointer(1)` lets a second finger press an ability box while steering; `drawStick`
  draws it in `drawHud`.

Randomness and timing: `Math.random` only draws the rosters, in `createGame` (the test seeds it, with
a seed picked for the roster the round was tuned with), and blue's class in watch mode (`watchMatch`); no `Date.now` or `performance.now` in the rules. Game time
advances only through `tick`, which the scene drives from frame times. The art uses its own seeded
generator (`seeded` in `lowpoly.ts`); `performance.now` only times the bake for a dev log.

### Sound

All sound is made in code by `shared/audio.ts`; `audio.ts` holds the game's song and effects. The
rules stay free of audio: `sound(s, id, at?, mine?)` in `sim.ts` pushes a `SoundEvent` onto
`s.sounds`, and `GameScene.playSounds` drains it each frame, playing the player's own (`mine`) and
ones with no place (no `x`) always and the rest only within the camera's view (plus 60 px) and out of
blue's fog. Where the AI shares the player's code (attacks, casts, bolts striking, item actives,
wards, arriving home), only `s.player`'s champion raises the sound (when watching, the champion the
camera follows). Towers' and the beast's attacks play at 0.55 volume; watching (`?watch`), the
`BUSY` combat sounds are skipped. The player's buttons play their sound straight from the scene.

Song `SONG`, D Dorian, 128 BPM:

- `pick`: the pick screen and the end panel, calm (Dm, C, G, Dm).
- `lane`: the match, an eight-bar march (`startMatch`).
- `tense`: an ostinato over driving bass while a blue tower, inhibitor or Nexus lost health in the
  last 8 s or the guardian beast is being fought (`lastHitBy` set); `updateMusic` checks each frame.
- Stings, when a Nexus falls (`updateMusic` sees the phase change, then back to `pick`): `win`,
  `lose`, and `end` for a watched match.

Effects (`sfx`), where they are raised:

| Sound | Where |
| --- | --- |
| `pick` | a pick card pressed (`refreshZones`) |
| `swing`, `shot`, `crit` | the player's melee or ranged attack, a crit or ambush hit (`attack`) |
| `towerShot`, `beastClaw` | a tower's or the beast's attack (`attack`); minions and camps are silent |
| `burst`, `bolt`, `dash`, `ally`, `buff`, `zone` | the player's cast, by the ability's kind, once per cast (`cast`) |
| `impact` | the player's bolt with a look striking (`updateProjectiles`) |
| `lastHit` | the player's last hit (`kill`) |
| `slain` / `youDie` | a champion falls / the player's falls (`kill`) |
| `streak` | a kill that sets or claims a bounty (`kill`) |
| `crash`, `wardBreak`, `nexus` | a tower or inhibitor, a ward, a Nexus falls (`kill`) |
| `levelUp` | the player levels up (`gainXp`) |
| `upgrade` | an upgrade card kept (`pickUpgrade`) |
| `blink`, `flask`, `ward` | the player's Phase Boots dash, flask, ward planted (`useActive`, `plantWard`) |
| `recall` / `recallHome` | the player starts a recall (`recall`) / arrives home (`finishRecall`) |
| `respawn`, `buyBack` | the player's champion respawns (`updateUnit`) / buys back (`buyBack`) |
| `wave` | a minion wave spawns (`tick`) |
| `mercs` | a mercenary band hired (`kill`) |
| `spell` | the player casts a battle spell (`castSpell`) |
| `rune` / `runeTaken` | runes appear / a rune taken (the player's own, or one in view) (`updateRunes`) |
| `watchstone`, `growl`, `beastSlain`, `brute` | a watchstone taken, the beast waking or turning elder, the beast slain, a brute's buff taken |
| `ping` | a ping sent by the player (`sendPing`), or an ally's danger call on blue's side (`championPlan`) |
| `drakeWakes` / `drake` | a drake wakes / is slain (`updateUnit`, `slayDrake`) |
| `firstBlood`, `plate` | the first champion kill (`kill`), a tower plate breaks (`breakPlates`) |
| `nightfall` / `daybreak` | night falls / day breaks (`tick`) |
| `comeback`, `vote` | the player's kill pays a comeback bounty (`kill`), the player calls a surrender vote (`callSurrender`) |
| `objective` / `objectiveMissed` | the player's objective done / missed (`updateObjective`) |

Shared `ui` sounds: `click` for the Shop button, B and Play again; `coin` for a purchase;
`refuse` for a purchase, cast, item active, recall or buy back the rules turn down.

### Hub settings

- `main.ts` calls `setupGame(game)` right after creating the game (frame cap, FPS readout, reduced
  motion and full screen).
- Difficulty scales red's damage: `ENEMY_DAMAGE = byDifficulty(0.8, 1, 1.25)` in `GameScene.ts`,
  applied through `dealt` in `sim.ts` to every red attacker (champions, minions and towers). Normal stays 1, which the playthrough expects.
- `settings.reduceMotion` skips the effect rings, attack lines and skill effects (`collectFx`) and
  holds zones' and auras' motion still but keeps the
  last-hit coins (they hold still instead of rising), holds the fountain's green motes still,
  turns off the hit flash, the objective marker's bob and its ring's spin, and makes the camera follow without easing. The game has no
  camera shake or screen flashes.
- Keep the Lane Brawl row of the difficulty table in the root README and the line in this game's
  README in step with `ENEMY_DAMAGE`.

## Testing hooks

- `window.game` in dev builds. The test reads `game.scene.getScene('Game')`: its `state` (copied
  through JSON) and its `cameras.main.worldView` (not `scrollX/Y`, which differ once `renderScale` zooms the camera),
  to turn world positions into view pixels. `e2e/screens.spec.ts` at the root opens the game on
  five screens.
- Inputs: it clicks the Warden's card at the pick screen (top left of the fifteen), presses B, clicks the Long Sword's card (T, V and X are never pressed),
  clicks the ground and the red tower, presses Q (down and up: abilities cast on the key's release), clicks the camp the second objective marks, clicks
  gold-outlined minions (`lastHitMark`) and clicks the first upgrade card. Clicks go to the canvas
  through the bounding box, never on the objective card (it blocks clicks).
- The test mirrors these, so change them together: the card, shop row, tower, objective card and
  upgrade card coordinates in `playthrough.spec.ts` (`WARDEN_CARD` (120, 133), `SWORD_ROW`,
  `RED_MID_TOWER` (1793, 1007), `OBJECTIVE_CARD`, `UPGRADE_CARD_1`) against `layout.ts` and
  `TOWERS`, `TOWER_REACH` against `TOWER.range`, `CAMP_GOLD` against `CAMP_KINDS`, the Warden's
  stats and Gatefall (Q) radius (`CHAMPIONS`), the Long Sword cost and damage (`ITEMS`), the first two
  `OBJECTIVES` (the tower: 150 s and 200 gold with the banner; then a camp, whose kind's gold plus
  120 the test checks; with the seeded roster it is the boar at (1280, 1900)),
  the Warden's level 2 `UPGRADES` pair (`wide-slam`, `stun-slam`), and the 240 s game-time budget.
- The seed in `addInitScript` is picked so the shuffle in `createGame` fields Harpooner, Tinker,
  Mage and Archer on blue and Stalker, Wolfkin, Bruin, Blade and Berserker on red, the roster the
  round was tuned with (about 2100 `Math.random` calls come before the shuffle in the browser).
  Anything that adds or removes draws before the shuffle (a new text on the pick screen too: each Phaser text draws for its texture key), or a sixteenth class, changes the roster:
  pick a new seed by replaying the generator and the shuffle in node, or re-tune the round.
- It asserts the first objective and its target (title key `objTowerMid`, so it passes in any
  language), the objective paid and the siege banner after
  the tower falls, the camp objective, at least one last hit and a streak, level 2's offer, and
  Wide Gatefall (`wide-slam`) kept from the card.
- Round 2 stays out of the first round: the AI buys only a Healing Flask and a ward at 0:00 (its
  wards and recalls change nothing the test asserts), `GANK.firstAt` keeps bounty hunts past it,
  and the player never recalls, wards or buys back. `SPELL_AI.from` keeps the AI's battle spells
  past it too, and the player never presses G.
- On the way to the tower the Warden waits out of its reach until a blue minion reaches it (and
  steps back out when none is left there, until the tower is under 200 health), and hits back (with
  Gatefall) at a red champion that comes within 240 px out of the tower's reach. It casts Gatefall on the camp too.
- It saves `0-pick`, `1-shop`, `2-tower-down` and `3-upgrade` screenshots. `SWORD_ROW` is a point inside the Long
  Sword's card in the four-column shop (`shopRow(0)`, so the Long Sword stays first in `ITEMS`;
  the card is 74 px tall from y 86, so the click at y 146 lands in its lower half). The round ends near 40 s of game time, before the beast wakes (90 s) and the first gank
  (100 s), so neither touches it, nor do the first runes (120 s); keep `BEAST.firstAt`, `GANK.firstAt` and `RUNE.firstAt` past it, and keep the
  bushes off the middle lane's paving and the path to the camp by the red mid tower. Copy them into
  `docs/screenshots/` as `playthrough-1-pick` to `playthrough-4-upgrade` when the look changes.
  `cover.png` (a copy of `new-cast.webp`), `new-cast.webp` (the shuffle steered with a fixed
  `Math.random` sequence so blue fields the five new classes), `ten-classes.webp`, `fog-of-war.webp`,
  `jungle-brute.webp`, `watchstone.webp`, `watch-ai.webp` (a `?watch` match at 8x with the log open), `skill-looks-1.webp` to
  `skill-looks-3.webp` (every ability's effect, five classes each), `aim-indicators.webp`,
  `home-heal-and-dead-shop.webp`, `scoreboard.webp` (a match run 7 minutes with blue's fifth on the AI, Tab held), `river-rune.webp` (run to 2:00, the Warden placed by the first spot), `merc-camp.webp` and `mercs-march.webp` (the Warden placed by blue's camp, then made strong to clear it), `pick-spell.webp` and `spell-button.webp` (the spell button pressed once, then a match run to 2:30 and Firebrand cast), `loop-objective.webp`, `loop-last-hit.webp` and
  `upgrade-*.webp` and `round2-*.webp` (the ward in the shop and planted by a bush, a recall, a
  bounty, the buy back button and the watch log of the AI shopping) and `german-pick.webp` (the pick
  screen with `?lang=de`, Grumm's card under the pointer) are staged docs shots (a scratch
  Playwright script that places units through
  `window.game` and lets the match run), not test output. The `loop-*` and `upgrade-*` ones predate
  the square map.

## Making common changes

- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and, when its spelling differs, the US one in `i18n/en-US.ts`; run
  `node scripts/check-translations.mjs`. German runs longer than English: the ability boxes (about
  ten characters; a longer name of several words shows only its first), the upgrade cards and the
  pick cards are the tightest spots, so check a new text with `?lang=de`.
- **Add a champion**: add a `ChampionDef` to `CHAMPIONS` with its `hero`, `short`, `title` and
  `motive` (90 characters at most), a blurb (32 characters at most, in lower case), a `PassiveDef` (a
  short desc), optionally a `perk` that fits the story, and four `AbilityDef`s (keys Q, W, E, R; R at level 3) named to fit the story,
  every text as a key (`<id>Name`, `<id>Hero`, `<id>Q` and so on) in `i18n/en.ts` and `i18n/de.ts`,
  its five upgrade pairs to `UPGRADES`, four looks in `skillFx.ts`, a `Kit` in `KITS` and its pose in
  `classPose` (`models.ts`) and its id to `ChampId`. `createGame` shuffles the classes other than the
  player's, gives blue the first four and red the next five, so any roster of ten or more works;
  the pick screen lays out `pickCard(i)` in three rows of five, so a sixteenth needs a new layout.
  Add the champion's row to the README's story table too. A new champion changes the shuffle, so the
  playthrough's seed may need picking again (see Testing hooks).
  A machine or beast sets `ownHead` on its `Kit` (the head draws its own skull and face) and
  `skin`, `legs` and `feet` for its hands, legs and feet. Update
  the README's champion and upgrade tables. Then run the balance check (see Gotchas).
- **Add a passive**: add its field to `PassiveDef` and apply it where it acts: `damage` (taken),
  `attack` (hits), `updateUnit` (over time) or `abilityDamage` (spells).
- **Add an ability kind**: add it to `AbilityKind`, handle it in `cast` (`sim.ts`) and, for AI use,
  in `aimFor`, give it an icon in `abilityIcon` (`GameScene.ts`) and its shape in `drawRanges`.
- **Give an ability its look**: add a `LOOKS` row `'<championId>.<key>'` in `skillFx.ts` (and a
  `drawProjectile` case and `HIT_COLOR` for a bolt, a `drawZone` case for a zone, a `drawAura` case
  for a buff). A new champion needs four, or its casts fall back to a plain ring.
- **Add or change an upgrade**: edit the champion's pair in `UPGRADES` (its name in the `i18n/`
  files); a new kind of effect needs a field on `UpgradeDef`, a line in `abilityFor` and its wording
  in `upgradeText` with a new `up*` text. The playthrough expects the Warden's level 2
  pair to be `wide-slam` then `stun-slam`.
- **Add an objective kind**: add it to `ObjectiveKind` and `OBJECTIVES`, pick its target in
  `updateObjective` and give the marker a height in `HEAD` if the target is a new kind of unit.
- **Change a model**: edit its builder in `models.ts`; the preview is the game itself. Keep the feet
  at the origin and the figure inside its `*_CELL` in `bake.ts` (raise the cell if a pose clips).
  More poses or directions multiply the boot bake (about two seconds in headless Chrome now, and a
  match's champions about one more).
- **Tune the map**: edit `LANES`, `TOWERS`, `CAMPS`, `WATCHSTONES`, `BUSHES` and `RIVER` in
  `data.ts`; `map.ts` paints from them. Give only blue's half and build red's with `both`/`mirror`,
  so the map stays fair, and check the playthrough still reaches the red mid tower at (1793, 1007).
- **Tune the fog**: `SIGHT` in `data.ts` (per unit kind) and `FOG_ALPHA` in `GameScene.ts`.
- **Add an item**: add it to `ITEMS` with its stats, and `from` for a recipe. `refreshStats` applies
  the stat fields it knows (`dmg`, `armor`, `hp`, `speed`, `atk`, `cdr`). The shop holds sixteen
  cards (4x4) and `ITEMS` fills them all, so a new item needs a new shop layout; put a new one into an AI build in `AI_BUILDS` if the AI should buy
  it. A new active needs an
  `ActiveId`, an `ACTIVES` row with a free key, a branch in `useActive` and an icon in the bottom
  bar's active buttons (`activeButton`, 30 px wide; a fourth needs the row widened).
- **Tune round 2**: `WARD` (carry, range, life, hits), `WARD_SPOTS` and `WARD_AI` for the AI's
  warding, `RECALL` (channel time and the AI's reasons to go home), `BUYBACK` (price and cooldown),
  `BOUNTY` (streak, gold) and `AI_BUILDS` / `AI_BUILD_FOR` (what each role buys), all in `data.ts`.
- **Tune the beast or the AI plans**: `BEAST`, `BEAST_BUFF`, `ELDER`, `BEAST_CONTESTERS`, `GANK` and
  `RETREAT` in `data.ts`. Move the pit with `BEAST.x`/`y`; `map.ts` paints it there.
- **Add a bush**: add it to `BUSHES` (blue's half; `both` adds the mirror); `map.ts` paints it and
  keeps pines out of it.
- **Tune the mercenaries**: `MERC` (spots, band size, power) and `CAMP_KINDS.merc` in `data.ts`.
- **Add a camp kind**: add it to `CampKind` and `CAMP_KINDS`, a model and sheet (`models.ts`,
  `bake.ts`), its sprite and `headOf` height in `GameScene.ts`, its clearing in `map.ts`, and its
  gold to `CAMP_GOLD` in the test if the camp objective can pick it.

## Gotchas

- Only champions, camps and the beast respawn (`revive` in `updateUnit`); a tower, inhibitor or
  Nexus that falls must stay dead, or the match never ends.
- `damage` ignores warded structures and `nearest` skips them, so minions walk past a warded
  inhibitor to the Nexus and wait there; anything new that hurts structures should go through
  `damage`.
- `hidden` is recomputed at the start of each tick, so a unit placed or moved in between is judged
  on the next tick. Anything that looks for targets (`nearest`, clicks, AI plans) must skip units
  `hiddenFrom` its team, or it would see through the fog.
- The fog is drawn with Graphics rectangles (`paintFog`, one per run of equal shade along a row),
  not a stretched canvas texture: an image of a CanvasTexture updated every frame did not show on
  the map in either renderer.
- Balance: a scratch harness bundles `src/game` with rolldown (`node_modules/.bin/rolldown`) and
  plays AI-only matches in node (the player's champion turned into an AI on a lane), counting
  wins, kills and deaths per class; run one after changing a champion, a passive or an ability.
- `kill` rewards only a champion killer: a tower or camp killed by a minion pays nothing. Minion
  gold for the player goes through the streak branch; AI champions always get the plain 19.
- Anything new that hurts a unit over time (a zone, a splash) should skip `'ward'` units, or a ward
  dies the instant it is touched, since every hit takes one of its three points.
- `aiShop` runs every tick a champion is home or dead, so it must stay cheap: one `nextBuy` scan
  and at most one purchase.
- Red's damage goes through `dealt`, so a new damage source on red must use it or it ignores the
  difficulty. The siege banner's bonus is applied in `damage` for the player's hits only.
- `refreshStats` heals by the increase in max health, so a level up or purchase tops the champion up
  by that amount, not to full; a dead champion (shopping while it waits) stays at 0 until `revive`.
- All HUD text sits above all HUD graphics (depth 12 over 10), so a panel drawn over another
  panel's text does not hide it: hide the covered panel instead (as the objective card does while
  the shop is open).
- `pointer.x/y` and `this.scale` are canvas pixels, `renderScale` times game pixels: read pointers
  through `viewPoint` or `worldAt`, and give anything new on the HUD a scroll factor of 0 so the
  fixed camera draws it.
- A sharper screen bakes bigger sheets and a bigger map, so the boot bake takes longer there (about
  1.8x at 4K); keep `RES` capped rather than raising it further.
- Texts re-render their canvas when their string, colour, size or weight changes; `t()` only sets
  what changed, which keeps the canvas renderer (used by the test) fast. Texts over one unit
  (`UNIT_TEXT`: `lvl-`, `cname-`, `bounty-`, `recall-`, `stun-` and its id) are destroyed once the
  unit is gone, so a new per-unit label belongs in that pattern.
