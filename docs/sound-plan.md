# Sound and music plan

Research for adding sound effects and music to every game, all made in code: sound effects
synthesized in a retro, jsfxr-like style, and chiptune music written as note data that a small
synth plays back. Nothing is implemented yet. None of the 21 games, `shared/` or the hub has any
audio today.

Riftblade is planned against its open PR #378 (seven blade knights and the Blade, Current and
Hollow skill pools), not against main, and its sound PR waits until that PR is merged.

## Shared setup (one PR, before any game)

**Settings.** Three new settings in `shared/settings.ts`: `music` (volume 0-100, default 60),
`effects` (volume 0-100, default 80) and `muted` (default off). The hub's Settings panel shows them
on its own, so it gets a new `range` kind in `SETTING_FIELDS` for the two sliders. Labels go in
`shared/i18n/en.ts`, `de.ts` and, where the spelling differs, `en-US.ts`.

**Sound button in every game.** A third corner button with a speaker icon goes next to the full
screen and pause buttons (bottom left, added by `setupGame`, so every game gets it with no code of
its own). A tap mutes or unmutes everything, and M does the same on a keyboard. The pause screen
gets the Music and Effects sliders, so the volume can be set without leaving the game. Every
change is saved to the shared settings, so it holds across all games and the hub.

**Space from the screen edge.** The full screen, sound and pause buttons sit in one row,
`calc(12px + env(safe-area-inset-left))` from the left and the same from the bottom, with 6px
between buttons (they were at 4px). The `env()` part only counts on a page that asks to draw
under the notch (`viewport-fit=cover`), which no game does, since that would put their canvases
under the notch; without it the browser already keeps the page inside the safe area, and the
12px clears the rounded corners.

Some games already have HUD in that corner, and the wider row covers a little more of it: Space
Wars (the bottom build cards), Anvilheart (the Auto Forge button), TinctureTinker (the hint line),
Hotfoot (the story line), Palisade (the level label) and Broadside (the helm). Each game's own
sound PR moves its HUD clear of the corner.

**The audio engine, `shared/audio.ts`** (estimated 6-10 KB, with no audio files):
- One `AudioContext` with a master, a music and an effects gain node, set from the settings.
- `sfx(name)` plays a sound from a game's sound table (a few numbers each: wave, pitch, slide,
  envelope, noise). Each sound is rendered to a buffer once, when the game loads. Every sound has a
  rate limit (for example one laser per 40 ms) and a small random pitch change, and at most about
  12 voices play at once, so a battle never turns into noise.
- `music(song, part)` plays a game's song: four chip voices (two pulse waves, a triangle and
  noise), scheduled slightly ahead on the audio clock so it never drifts. A game switches parts
  (calm, battle, boss) at the next bar, and short stings (win, game over) lower the music while
  they play.
- A song is a few KB of note data per game, in `games/<name>/src/audio/`.

**Mobile autoplay.** Browsers only start sound after a tap, and the shared Start button is that
tap, so the engine starts there (or on any first tap or key press). The music plays on, quietly
under the pause screen so the volume can be heard as it is set, and stops while the tab is hidden.

**Tests.** Under browser automation (`navigator.webdriver`) the engine creates no `AudioContext`
and every call does nothing, the same way the start screen is skipped. The playthroughs therefore
play exactly as today and stay deterministic. `e2e/hub.spec.ts` gets a check that the sound button
toggles the setting, plus a check that the corner buttons stay inside the safe area.

**Rules for every game:**
- Play one sound per volley, not per bullet.
- Play only what the player can see: nothing fogged or far off screen.
- Make sounds for the player's own actions only, even where the AI runs the same code.
- Stay silent while a game replays time (Apothecary's catch-up on load) or restores a save.
- In `?watch` mode, play the music, a quieter and thinned-out battle, and a neutral winner sting.
- Give every refused action (can't afford, can't place) the same soft low buzz, so it means one
  thing everywhere.
- Each game's `AGENTS.md` lists its songs, its sound table and where they are triggered.

**Order of work:**
1. One shared PR: settings, engine, sound button, pause sliders and corner spacing (draft until
   the Riftblade heroes thread is finished).
2. One PR per game, each with its sound effects and music together.
3. Riftblade last, once PR #378 is merged.

Since I can't listen to the result, each game PR needs a listen before it is merged.

## Where each game hooks in

Many games already keep an event list each frame, and one `switch` over it covers most of
their sounds:

| Game | Hook |
| --- | --- |
| Anvilheart | `s.events`, drained in `GameScene.drawEvents` |
| Augury | `RunEvent`, drained in `GameScene.drain` |
| Beehive Baron | `GameEvent` list, drained in `GameScene.drawEvents` |
| Broadside | `s.effects` via `effect()` in `sim.ts` |
| Catacomb | `s.pops` via `pop()` (kinds damage, block, heal, status), plus the sim's actions |
| Colonizer | `s.events`, drained in `GameScene.drainEvents` (already checks `visible`) |
| Hotfoot | effects queue, new ids in `GameScene.drawEffects` |
| Lane Brawl | `s.fx`, drained in `GameScene.collectFx` (already skips fogged fx) |
| Lanternkeep | `GameEvent`, drained into `GameScene.showEvent` |
| Ninefold | `GameEvent`, drained in `GameScene.drain` |
| Palisade | `state.effects`, new ids in `GameScene.drawEffects` |
| Scrapyard Titans | battle events, in `GameScene.consume` |
| Shrine Stack | `GameEvent`, drained into `GameScene.show` |
| TinctureTinker | `Step[]` animation queue, in the `start` callbacks of `playStep` |

These games call it from the scene or sim at the places listed in their tables: Apothecary,
Bramblecrest, Deadline, Golem Garden, Mapmaker, Riftblade, Space Wars, Tiny Kingdom and Wyrmrail.

## Per game

Each section gives the music, then the sound effects with where they are triggered (paths under
`games/<name>/src/`, line numbers from the version read). Under "Sound", "buzz" always means the
shared soft refusal sound.

### Anvilheart
Merge game in a stained-glass smithy; warm, satisfying crafting.

**Music:** Folk groove at about 108 BPM in C major, with a Lydian lift for big moments. Voices are
a square lead, triangle bass, pulse plucks, and noise percussion tuned like hammer clinks.
- Hammer streak: a busier layer.
- Crown chooser or edict window open: a tense high variant.
- Stings for the Crown Blade win and a new charter.

| Event | Sound | Where |
|---|---|---|
| Forge makes a dagger, gem or buckler | short hiss plus metallic clink | `game/sim.ts:forge` (`forged` event) |
| Forge not hot yet, board full | dull low click | `sim.ts:forge` returns false |
| Pick up a sword / put down, move, swap | light metal scrape / soft clunk | `scenes/GameScene.ts:pickUp`, `putDown` → `sim.ts:drop` |
| Merge into next tier | anvil clang, pitch rising with tier | `sim.ts:drop` (`merged`) |
| Hammer streak xN | clang plus rising coin arpeggio | `sim.ts:hammer` (`streak`) |
| Masterwork strike | bright bell chord plus shimmer | `sim.ts:drop` (`master`) |
| Gem set / battered sword repaired | crystalline ping / hammer taps plus coin | `sim.ts:drop` (`set`, `repaired`) |
| Sword rusts a tier | dull detuned low thud | `sim.ts:rust` (`rusted`) |
| Sell (exact fit / overkill), buckler handed | ka-ching plus tip sparkle / plain coin | `sim.ts:sell` (`sold`, `handed`) |
| Adventurer arrives / hero returns with trophy | door bell / proud 3-note motif | `sim.ts:arrive`, `comeBack` (`returned`) |
| Adventurer walks off | grumpy falling square slide | `sim.ts:tick` (`left`) |
| Deliver to the crown / commission complete | regal chime / fanfare plus coins | `sim.ts:deliver` (`delivered`, `commission`) |
| Crown Blade won / charter founded / edict chosen | victory fanfare / rising arpeggio / seal thunk | `sim.ts:deliver` (`won`), `foundCharter`, `chooseEdict` |
| Buy upgrade, row, barrel, perk / can't afford | coin blip / buzz | `sim.ts:buy`, `buyPerk` |
| Shield mode, Auto Forge, UI buttons | switch click | `sim.ts:toggleShieldMode`, `toggleAutoForge`; `ui/Button.ts` |

Notes:
- Auto Forge forges about every 1.2 s, so keep the forge sound quiet while it is on.
- Ambience: a furnace crackle loop.

**Done** (see `games/anvilheart/AGENTS.md`, "Sound"): parts `calm`, `streak`, `tense` and the
stings `win` and `charter`, in `src/audio.ts`. The forge refusals, failed buys and drops a target
won't take play the shared `refuse` buzz rather than a click, and an adventurer's door bell plays
from `GameScene.drawVisitors` (there is no `arrive` event). The left button column moved up and
right, clear of the corner. No furnace ambience loop, since the engine has none.

### Apothecary
Cosy crafting and shop automation; a calm herbalist's almanac.

**Done** (see `games/apothecary/AGENTS.md`, Sound). Differences from the plan below: the market
rush is its own song (`RUSH_SONG`, 96 BPM) since a song has one tempo; every sound plays from
`GameScene` (marker callbacks, and `createSound` comparing the state each frame for the sim's own
events) rather than from `sim.ts`; a kept contract plays the `kept` fanfare sting in place of the
new day's bell, a missed one two low notes and then the bell; the plague starting, a new season and
a relapse share the tolling `relapse` sting; a sale plays a soft coin and a filled order the
ka-ching; purple markers buzz once a visit when there are no coins. No ambience yet.

**Music:** Modal folk at about 84 BPM in D Dorian. Voices are a soft pulse lead like a recorder,
triangle bass, a plucked square arpeggio and light shakers.
- Market-day rush: brighter, at about 96 BPM.
- Plague, from day 5 (`state.plague`): a darker minor variant.
- Stings for the new day, the cure win and a relapse.

| Event | Sound | Where |
|---|---|---|
| Harvest a ripe bed / clear a blighted bed | airy swish plus pluck / duller rasp | `game/sim.ts:harvest`, `clearBlight` |
| Drop goods at table or cauldron / pick up | wooden thunk / small rising blip | `sim.ts:dropAtRefiner`, `dropInCauldron`, `pickUpOne`, `pickUpFromCauldron` |
| Fine potion picked up in the gold window | sparkly two-note chime | `sim.ts:pickUpFromCauldron` (`inFineWindow`) |
| Brew or refine step done | bubble pop | `sim.ts:tick` refiner loop, `brew` |
| Pay coins towards an upgrade | tiny coin tick, rising as it fills | `sim.ts:pay`, `payToward` (5 per second) |
| Upgrade done, craftsman, pixies, recipe | bright 3-note arpeggio | `sim.ts:payLevel`, `payToward`, `payBelt` |
| Throw an item away | short falling blip | `sim.ts:dropItem` |
| Serve a customer, order filled | ka-ching | `sim.ts:serveFromShelf`, `orderFilled`, `serveOrder` |
| Collect till, sell to wagon, herb market | coin cascade | `sim.ts:collectTill`, `sellToWagon`, `buyHerb`, `sellHerb` |
| Customer walks off | low falling "hmph" | `sim.ts:tick` (patience out) |
| Contract kept / missed | short fanfare / two low notes | `sim.ts:deliverForContract`; `tick` |
| New day / market-day crowd | soft bell / quick jingle | `scenes/GameScene.ts:createDayBar`; `sim.ts:startRush` |
| Blight strikes | low wobbly buzz | `sim.ts:blight` |
| Plague advances / relapses / cured | hopeful bell / tolling bell / victory sting | `sim.ts:deliverForPlague`, `relapse`; `GameScene.ts:showWin` |
| Signs and HUD buttons | soft paper click | `sim.ts:cycleSign`, `cyclePriority`, `replantGarden`; `GameScene.ts:hudButton` |

Notes:
- `catchUp` (`game/away.ts`) replays the time the player was away on load, so trigger sounds from
  the scene or mute during it.
- Pixies on belts: no sound per pixie.
- Ambience: a cauldron bubble loop while it works, and rain on rain days.

### Augury
Nine kinds of brain puzzle dealt as tarot cards; calm, starlit, a harp in a quiet room.

**Done** (see `games/augury/AGENTS.md`, Sound).

**Music:** A harp-like triangle lead in D minor at 76 BPM.
- Menu, practice picker and records: a slow two-bar loop.
- A puzzle in Endless, Daily, Draft, Practice or pass and play: a four-bar tune with a light kick and hat.
- Blitz: the same key in running sixteenths with busier drums.
- A sting when a run ends.

| Event | Sound | Where |
|---|---|---|
| Pick a cell, island or block | soft tick | `views/*` through `ctx.tap` |
| A move on a puzzle | two-note pluck | `scenes/GameScene.ts:ctx` (`act`) |
| A puzzle dealt | card laid down | `GameScene.ts:drain` (`start`) |
| Solved / lost, skipped or out of time | rising arpeggio / low buzz | `GameScene.ts:drain` (`end`) |
| A heart lost | falling buzz | `GameScene.ts:drain` (`heart`) |
| Hint / last five seconds | bright arpeggio / short tick | `GameScene.ts:drain` (`hint`, `warn`) |
| Memory Echo card turned | soft flick | `GameScene.ts:update` |
| Relic taken | sparkle | `GameScene.ts:drain` (`relic`) |

### Beehive Baron
Idle beehive in cut paper; warm, sunny, relaxed.

**Music:** Lilting folk-pop at about 104 BPM in C major. Voices are a square lead with vibrato,
triangle bass and soft hats.
- One variation per season: spring bright, summer full, autumn mellow (Dorian), winter sparse and
  slower.
- The county fair has its own jig.
- A fanfare for the Beehive Baron end card. There is no game over.

| Event | Sound | Where |
|---|---|---|
| Build cell or brood cell | paper "pap", one pitch step per touching edge | `game/sim.ts:place` (`built`) |
| Build or harvest refused | buzz | `scenes/GameScene.ts:act` (`done === false`) |
| Send foragers / nectar delivered | rising swarm whoosh / tiny droplet blip | `sim.ts:send`; `nectar` event |
| Cell capped / harvest jar | wax "tok" and shimmer / glass clink | `capped` event; `sim.ts:harvest` |
| Sell jars / order done | coin cascade / bigger ka-ching | `sim.ts:sell` |
| Spilled, stolen, winter ate honey, starving | sad falling blip; longer minor drop when starving | `spilled`, `stolen`, `ate` events |
| Wasp arrives / swatted / chased by guards | angry buzz while present / whack / zap | `wasp` event, `sim.ts:swat`, `guarded` |
| Bee hatched | cute chirp | `hatched` |
| Meadow unlocked / demand shifts / meadow wilted | arpeggio / two-note notify / drooping wobble | `unlocked`, `demand`, `wilted` |
| Village order arrives / lapses | pin and ding / sad blip | `order`, `order-failed` |
| Season turns / year survived | seasonal motif / chime | `season`, `year` |
| Shop upgrade / tab or market pick | ka-ching / paper click | `sim.ts:buy`, `forage` |
| Cask filled / mead ready | barrel thunk / cork pop | `casked`, `mead` |
| Swarm ready / gone / caught | rising buzz / fading buzz / regal chord | swarm events, `sim.ts:catchSwarm` |
| Orchard contract offered, lent, back, lapsed | ding / coins / buzz home / sad blip | contract events |
| Fair: opens, entry, judged, gold, closed, Baron | jingle / stamp / blip / fanfare / chime / big fanfare | fair events; `GameScene.ts:showEnd` |

Notes:
- Nectar comes in bunches (up to 24 bees), so play at most one blip per 100 ms.
- Ambience: a hive hum that follows the bees at home, and birdsong in spring and summer.

Done: `games/beehive-baron/src/audio.ts`, played from `GameScene.playEvents` (see the game's
`AGENTS.md`). Winter is half time rather than a slower tempo, a `gold` sting covers later golds,
the season's part switch stands in for its motif (plus a chime), and the ambience is not built.

### Bramblecrest
Top-down adventure in a lamplit village and woods at night; cosy, mysterious, moonlit.

**Done** (see `games/bramblecrest/AGENTS.md`, Sound). Besides the table below it also has a fuse
tick, a room door slamming, a dug-up glint, the wisp's hop and a boss-victory sting. Ambience and
footsteps are left out.

**Music:** Gentle themes at 72-90 BPM, one per area.
- Mossford: a lullaby waltz in F major, with a triangle lead, a square pad and no drums.
- Bramble Woods and Glimmer Fen: A minor or Dorian, with pulse arpeggios and a shaker.
- Sunken Shrine and Drowned Belfry: slow minor loops over a bass drone.
- Thornmother and Bellwraith: boss loops at about 140 BPM.
- Stings for an item get, a moonstone, and the chapter end (three variants, by stones found).

| Event | Sound | Where |
|---|---|---|
| Sword swing / cut bush or thorns | swish / leafy crunch | `scenes/GameScene.ts:startSwing`, `cut` |
| Roll | short whoosh | `GameScene.ts:startRoll` |
| Hookvine throw / latch and pull | rising zip / thwack, then a sliding tone | `GameScene.ts:fireVine`, `updateHook` |
| Plant bellseed / fuse / burst | plop / ticking pulse / low boom | `GameScene.ts:plantSeed`, `updateBombs`, `burst` |
| Boulder or cracked wall breaks | rock crumble | `GameScene.ts:breakRock` |
| Push block / plate pressed, bars lift | stone scrape / click plus "solved" chime | `GameScene.ts:push` |
| Unlock key door / open chest, item get | key clink and latch / creak, then fanfare | `GameScene.ts:interactAt`, `openChest` |
| Moonstone found / heart or seed pod | sparkling 5-note arpeggio / soft ding | `GameScene.ts:gainStone`, `pickups` |
| Talk, next line | text blips, pitch by speaker | `GameScene.ts:openDialog`, `nextLine` |
| Ring belfry bells / wrong / right tune | three real bell pitches / dissonant buzz / chord | `GameScene.ts:ringBell` |
| Foe hit / beaten | squishy hit / pop puff | `GameScene.ts:hitFoe` |
| Knight hurt / falls | sharp blip down / sad phrase, then wake chime | `GameScene.ts:hurt`, `fall` |
| Thornling spit, boss thorn volley | small "ptoo" | `GameScene.ts:shoot`, `updateBoss` |
| Thornmother: bulb yanked, hit, defeated | twang / squelch / victory | `GameScene.ts:yank`, `hitBulb`, `bossDown` |
| Bellwraith: shudder and slam, tipped, hit, defeated | rattle and huge bell clang / toppling clang / ghostly wail / victory | `GameScene.ts:updateWraith`, `tipBell`, `hitWraith`, `wraithDown` |
| Map change / chapter end | soft swell / ending sting | `GameScene.ts:enterMap`, `chapterEnd` |

Notes:
- The bell puzzle becomes a puzzle you can hear, once each bell has its own pitch.
- Ambience fits this game best of all: crickets and frogs at night, water in the Woods and Fen,
  and drips in the dungeons.
- Footsteps would need throttling.

### Broadside
Real-time naval battle on an engraved sea chart; swashbuckling and tense.

**Done.** Built as planned, with these differences: the calm and the battle music are two songs
(`HARBOR_SONG` at 66 and `BATTLE_SONG` at 112 dotted quarters, since a song has one tempo), the
heavy `boss` part starts once a flagship or the admiral is on the sea, the wave start and harbor
are stings, and the sounds are played by `scenes/soundCues.ts` from what each tick changed, so
`sim.ts` has no audio. Hits near the player, a sail on the horizon (`pipe`), a full charge and a
helm creak are added; there is no ambient wash. The helm wheels and fire controls moved up 36 and
28 px to clear the corner buttons. Its table is in `games/broadside/AGENTS.md`.

**Music:** Sea-shanty jig in 6/8, in D minor (Dorian). Voices are a square lead, a pulse
"accordion", triangle bass and noise drums.
- Harbor and the break before each wave: calm, at about 100 BPM.
- Fighting: a battle loop at about 140 BPM.
- Flagship waves and the wave-20 haven: a heavier variation.
- A sinking dirge and a win fanfare.

| Event | Sound | Where |
|---|---|---|
| Charging a broadside | rising whine following the charge | `game/sim.ts:aimBroadsides` |
| Player broadside / grapeshot | staggered low booms, louder with charge / plus crackle | `sim.ts:firePlayer`, `fire` |
| Enemy and escort broadsides | same boom, quieter | `sim.ts:enemyBroadsides`, `escortBroadsides` |
| Ball hits / misses | wood crack / soft splash | `sim.ts:moveBalls` (`hit`, `splash`) |
| Mortar or fort shell | hollow thump, falling whistle, blast | `sim.ts:lob`, `landShells`, `blast` |
| Running aground | grinding thud | `sim.ts:runAground` |
| Enemy sunk / fireship or fort blown up | falling rumble with gurgle / big explosion | `sim.ts:sink`, `ram`, `raze` |
| Prize taken (boarding) | rising "hurrah" arpeggio | `sim.ts:board` |
| Loot hauled in / bounty paid | coin jingle / bigger chord | `sim.ts:haulIn`, `reachHarbor` |
| Merchant escapes / convoy arrives | sad two-note drop / bell chime | `sim.ts:escape`, `arrive` |
| Ship on the horizon / wave starts | bosun's pipe / drum roll and horn | `sim.ts:spawn`; `tick` (`fighting`) |
| Harbor opens | victory jingle, then the calm loop | `sim.ts:reachHarbor` |
| Harbor buy, repair, hire, shot, perk, sail / refused | click and ka-ching / buzz | `scenes/GameScene.ts:harborAction` |
| Scuttle prize | explosion and coins | `sim.ts:scuttle` |
| Player sunk / campaign won | game-over sting / fanfare | `sim.ts:playerSunk`; `tick` (`won`) |

Notes:
- Hits and splashes come many per frame, so they need rate limits.
- Ambience: a wave wash, plus wood creaks while steering.

### Catacomb
Turn-based dungeon deckbuilder; dark and gothic.

**Done:** see the Sound section of `games/catacomb/AGENTS.md`. It differs from this plan in a few
places: the map and the fights are two songs (80 and 120 BPM), elites share the bosses' `boss`
part, the Bone King's fall gets a `triumph` sting, and every sound is started from the scene (the
tap handlers and a per-frame `Cues` diff of the state), not from `sim.ts`, which stays free of sound.

**Music:** A dirge in A minor (harmonic minor).
- Map: about 80 BPM over a triangle drone.
- Fights: about 120 BPM with drums. Elite and boss fights (Bone King, Hollow Queen) get a heavier
  variation.
- Act 2 (Sunken Tombs): a darker variation.
- Campfire, merchant and mystery rooms: calm loops.
- Defeat and victory stings.

| Event | Sound | Where |
|---|---|---|
| Hero picked / depth changed | heavy click / ratchet | `game/sim.ts:chooseHero`, `setDepth` |
| Walk / enter room | footsteps / door creak | `sim.ts:walkTo`, `enterRoom` |
| Fight starts | drum hit, plus a stab for elites and bosses | `sim.ts:startFight` |
| Draw / reshuffle | paper flick / riffle | `sim.ts:drawCards` |
| Play attack / skill / power | sword swish / soft chime / deep swell | `sim.ts:playCard` |
| Can't play (no energy) | buzz | `scenes/GameScene.ts` when `playCard` returns false |
| Foe hit / dies | thwack / crumbling noise | `sim.ts:damageEnemy` |
| Hero hit / fully blocked / block gained | thud / metallic clang / shield clank | `sim.ts:damageHero`, `gainBlock` |
| Status applied, poison tick | hissy bubble / sickly wobble | `sim.ts:applyStatus`, `endRound` |
| Heal, strength | soft rising arpeggio | `sim.ts:heal`, `startTurn` |
| Curse added / Wound drawn | ominous chord / hurt thud | `sim.ts:curse`, `drawCards` |
| End turn / foe acts | tick-tock / attack, block or buff sound | `sim.ts:endTurn`, `act` |
| Flask drunk | glug and sparkle | `sim.ts:useFlask` |
| Fight won, gold, reward | victory jingle, coins, card select | `sim.ts:clearFight`, `winFight`, `takeReward` |
| Campfire rest / temper / burn | crackle and chord / anvil ting / fire whoosh | `sim.ts:rest`, `temperCard`, `removeCard` |
| Shop buy / mystery choice | ka-ching / mysterious chime | `sim.ts:buyCard`, `buyRelic`, `buyFlask`, `buyRemoval`, `chooseEvent` |
| Descend / defeat / dungeon cleared | stair rumble / sting / fanfare | `sim.ts:descend`; phase `over` / `won` |

Notes:
- Attacks that hit every foe make several pops at once, so deduplicate per frame.
- Ambience: drips and wind on the map.

### Colonizer
Base-building strategy drawn as a medieval tapestry; stately and slow-building.

Done: see `games/colonizer/AGENTS.md` (Sound). The raid music is its own song at 132 BPM, the
5-note age fanfare is a sting, and a selected unit, every trade and a building falling on screen
have sounds too.

**Music:** Medieval dance at about 96 BPM in D Dorian, turning Mixolydian in later ages. Voices
are a square lead like a shawm, a triangle drone and noise drums.
- Each age gets a fuller arrangement.
- Raids: about 132 BPM with war drums and a horn.
- Monument countdown: its own variation.
- Victory and defeat stings.

| Event | Sound | Where |
|---|---|---|
| Select / order | wood click / acknowledge blip | `scenes/GameScene.ts:onPointerDown`, `commandAt` |
| Can't place | buzz | `GameScene.ts:tryPlace` |
| Building placed / finished | hammer taps / rising chime | `GameScene.ts:tryPlace`; `game/sim.ts:finish` |
| Train or research queued / unit trained | quill blip / pop and trumpet | `sim.ts:train`, `research`, `updateBuilding` |
| Age up / boon or edge picked | 5-note fanfare / confirm chord | `sim.ts:updateBuilding`, `chooseBoon`, `chooseEdge` |
| Drop-off of wood, food or ore | knock / pluck / clink | `drop` event, `GameScene.ts:drainEvents` |
| Melee / ranged hit / tower volley | clash / arrow thwip / several thwips | `sim.ts:strike`, `updateBuilding` |
| Town bell rung / released | bell toll / lower toll | `sim.ts:ringBell`, `releaseBell` |
| Attack alert (a new fight on the player's side) | short alarm horn, louder when out of sight | `GameScene.ts:alarm`, when it announces a new alert |
| Jump to an alert (Space, toast or edge arrow) | quick whoosh | `GameScene.ts:jumpTo` |
| Rally flag set / taken down | cloth flap / lower flap | `GameScene.ts:plantRally` (`rallySet`, `rallyCleared`) |
| Raid incoming / repelled | war horn / triumphant horn | `sim.ts:startRaid`, `endRaid` |
| Market trade / cache, relic held or lost | coins / chime, rising or falling arpeggio | `sim.ts:trade`, `updateCamps` |
| Monument stands | solemn drone chord | `sim.ts:finish` |
| Town Center falls / win / lose | crumble, then end sting | `sim.ts:checkWinner`; `GameScene.ts:showEnd` |

Notes:
- Big armies send dozens of hits per second, so rate-limit per type and play only what is
  visible.
- Watch mode gets a neutral end sting (`showWatchEnd`).
- The attack alarm plays once per alert, not per hit: a fight that keeps going inside an alert's
  12 tiles stays silent until the alert ends.

### Deadline
Upright zombie wave defence with auto-fire; tense pulp horror.

**Done** (`games/deadline/src/audio.ts`, listed in the game's `AGENTS.md`). The boss song is a
second `Song` at 150 BPM; blackout and blood moon share one `dark` part (low half steps, as the
engine has no detune); the boss warning is the `warn` sting; survivor hits, rescues, ricochets
and shield breaks have their own sounds.

**Music:** Driving chiptune at about 140 BPM in E minor (Phrygian), with a square lead, a thin
pulse arpeggio, a triangle bass ostinato and drums.
- Breaks: the drums drop to a pad.
- Boss waves (`state.bossKind`): heavier, at about 150 BPM.
- Frenzy: double hats.
- Blackout and blood moon: detuned variants.
- Stings for game over, extraction and the boss warning.

| Event | Sound | Where |
|---|---|---|
| Volley fired | noise "pew", one per volley | `scenes/GameScene.ts:fire` |
| Bullet hits / shield blocks | quiet tick / metallic ping | `GameScene.ts:hurt`, `chipShield` |
| Zombie killed | wet noise burst, pitch by kind | `GameScene.ts:kill` |
| Frenzy starts | rising sweep and power chord | `GameScene.ts:kill` (frenzy) |
| Fuel drum explodes | long low boom | `GameScene.ts:explode` |
| Crate opened, upgrade, perk evolves | rising arpeggio, longer for a perk | `GameScene.ts:collect` |
| Grenade / flamethrower | thump and noise / filtered whoosh | `GameScene.ts:grenade`, `tickFlamer` |
| Sandbags placed / smashed | heavy thud / crunch | `GameScene.ts:placeWall`, `smashWall` |
| Acid lob / pool | gurgly blip, then sizzle | `GameScene.ts:lobAcid`, `moveAcid` |
| Boss winds up | two-tone siren | `GameScene.ts:tickBoss` |
| Survivor hit / lost / rescued | yelp / low fall / friendly chime | `GameScene.ts:hurtSurvivor`, `rescue` |
| Medkit used | heal arpeggio | `GameScene.ts:useMedkit` |
| Wave start / boss / cleared | drum hit / low horn / victory blip | `GameScene.ts:startWave`, `checkWave` |
| Supply drop and role pick | shuffle / confirm | `GameScene.ts:showSupply`, `pickSupply`, `pickRole` |
| Game over / extraction, operation won | falling sting and crash / major sting | `GameScene.ts:gameOver`, `endAsWin` |
| Shop buy / can't afford / style switch | coin / buzz / click | `GameScene.ts:buyKit`, `buyOutpost`, `switchStyle` |

Notes:
- `hurt` fires for every pellet, so play at most one per 50 ms.
- Kills come in clumps, so cap the voices.
- The comic lettering (BLAM, SPLUT, BOOM) marks good moments for a louder accent.

### Golem Garden
Claymation tower defence; playful and earthy.

**Music:** Bouncy pastoral in G major pentatonic, with an ocarina-like pulse lead, triangle bass
and shakers.
- Build phase: about 96 BPM.
- Waves: about 132 BPM.
- Queen Slug waves: a minor variation.
- A harvest win sting (one note per star) and a game-over sting.

| Event | Sound | Where |
|---|---|---|
| Seed card or hedge picked | clay squish click | `game/state.ts:select` |
| Plant / refused | squelchy plop / buzz | `scenes/GameScene.ts:tapCell` → `state.ts:plant` |
| Golem grown | rising "boing" | `state.ts:step` (`growMs` reaches 0) |
| Raise level, form picked | ascending arpeggio, bigger at level 3 | `GameScene.ts:menuTap` → `state.ts:upgrade` |
| Aim / move / uproot | tick / slide / pop and coins | `state.ts:setTarget`, `move`, `uproot` |
| Pebble, moss, thorn | "thup" / wet splat / high scratch | `state.ts:step` (`s.shots.push`) |
| Pest hit (armour) | tiny tick (metal clink) | `state.ts:step` (`hit()`) |
| Pest squashed, sap | squish plus bright blip | `state.ts:step` pops; `GameScene.ts:sapPop` |
| Crow, mole, queen spawn | caw / dig rumble / low groan | `state.ts:step` queue |
| Hedge chewed through / Heartwood bitten | crunchy snap / wooden thud | `state.ts:step`; `GameScene.ts:heartHit` |
| Start wave, call early | horn or whistle | `GameScene.ts` (`startWave`) |
| Wave cleared, bud opens, bloom | jingle, chime per bud, full chord | `GameScene.ts:waveDone` |
| Regrow leaf / boon | rustle and chime / sparkle | `state.ts:regrow`, `takeBoon` |
| Harvest / Heartwood falls | win sting / game-over sting | `GameScene.ts:update` (`showPicker`) |

Notes:
- Throws are the busiest sound, and 2x speed doubles them, so play at most one per golem kind
  every 70 ms.
- Done: `games/golem-garden/src/audio.ts`, played from `GameScene` (see the game's AGENTS.md).
  Build and waves are two songs (96 and 132 BPM); the harvest sting has one part per star count.
  Also a hedge-planted rustle, a level-up pitch per level and a bud chime rising per bud.

### Hotfoot
Endless auto-runner with boons and bosses; lively manuscript adventure.

**Done.** Built as planned in `games/hotfoot/src/audio/`, played from the scene (`SoundCues`), so
the sim stays free of audio. Differences: the shrine's refusal uses the shared `refuse` buzz, the
Gatekeeper's win is an effect rather than a sting, there is no separate wind ambience (the Windy
Pass loop is airy instead), and the margin caption moved to the middle, clear of the corner.

**Music:** Galloping chiptune at about 150 BPM in D Mixolydian, with a square lead, a pulse
counter-melody, a triangle bass in a gallop rhythm and drums.
- One variation per terrain: ice sparkly, fen murky, wind airy.
- Gatekeeper and dragon: a boss loop.
- Rockfall: a tense layer.
- Campfire checkpoint: a calm loop.
- A game-over sting and the dragon's crown fanfare.

| Event | Sound | Where |
|---|---|---|
| Jump / air jump | rising "boing", higher in the air | `game/sim.ts:jump` |
| Slide / air drop | noise slide / fast down-sweep | `sim.ts:slide` |
| Land / skid on ice | soft thud / scrape | `sim.ts:tick` (dust, skid) |
| Coin, streak | coin blip, rising with the streak | `sim.ts:tick`, `gainCoin` |
| Stomp | squishy pop and bounce | `sim.ts:stomp` |
| Hit / blocked by Aegis | crunch with falling tone / clang | `sim.ts:hurt` |
| Fire vent warns / flares | crackle / whoosh | `game/state.ts:flameOf` |
| Shrine heals / refuses | chime / two-note "nope" | `sim.ts:visitShrines` |
| Herald's dare met | fanfare and coins | `sim.ts:meetDare` |
| Boss throws | whoosh / roll rumble | `game/boss.ts:throwOne`, `startVolley` |
| Boss stomped / beaten | heavy thump / victory fanfare | `sim.ts:bossContact` |
| Rockfall hit | rumbling crash | `sim.ts:tick` (`rock`) |
| Checkpoint / boon / pair complete | arrival chime / confirm / magic arpeggio | `sim.ts:tick`, `pick`, `pickRoad` |
| New stage title | heraldic horn | `game/course.ts:nextStage` |
| Game over | falling minor sting | `sim.ts:hurt` (`over`) |
| Shop buy / can't afford / run again | coin / buzz / whoosh | `sim.ts:buyMissed`, `buyArmoury`; `GameScene.ts:restart` |

Notes:
- Coins come in rows, so arpeggiate them up the streak rather than stacking blips.
- Ambience: wind on the Windy Pass.

### Lane Brawl
Single-player five-against-five lane battler; bright and competitive.

**Done:** built as planned (`src/audio.ts`; the list of sounds is in the game's `AGENTS.md`). The
sim raises `SoundEvent`s in `s.sounds` for the scene to play, as fx already go; minion and camp
attacks stay silent, and the pick theme also plays under the end panel.

**Music:** Heroic march at about 128 BPM in D Dorian.
- Champion pick: a calm theme.
- Laning: the main loop.
- Your towers under attack or the guardian beast up: a tense variation.
- Victory and defeat stings, plus a neutral "Blue/Red wins" sting for watch mode.

| Event | Sound | Where |
|---|---|---|
| Pick champion, start | rising arpeggio | `scenes/GameScene.ts:startMatch` |
| Melee swing / ranged shot / crit | swish / thin "pew" / crunchy accent | `game/sim.ts:attack` |
| Ability cast, by look | burst thump, bolt zap, dash whoosh, ally chime, zone bubble | `sim.ts:cast`; `scenes/skillFx.ts` |
| Projectile impact | small crackle | `sim.ts:updateProjectiles` |
| Last-hit coin | high two-note ding | `sim.ts:kill` |
| Champion slain / you die | falling square plus noise, darker for you | `sim.ts:kill` |
| Kill streak, bounty | triple fanfare | `sim.ts:kill` |
| Tower or inhibitor falls | heavy crash | `sim.ts:kill` |
| Level up / upgrade picked | 4-note arpeggio / confirm | `sim.ts:gainXp`, `chooseUpgrade` |
| Shop buy / refused | cash blip / buzz | `sim.ts:buy` |
| Dash, flask, ward | whoosh / glug / plink | `sim.ts:useActive`, `plantWard` |
| Recall, arrive / buy back, respawn | shimmer, chime / coins, pop-in | `sim.ts:startRecall`, `finishRecall`, `buyBack`, `revive` |
| Minion wave | distant horn | `game/state.ts:spawnWave` |
| Watchstone, beast or elder, objective | bell / growl / fanfare | `sim.ts:updateWatchstones`, `updateUnit`, `updateObjective` |
| Nexus falls | big boom, then the end sting | `sim.ts:kill` |

Notes:
- Ten champions, minions and towers attack many times a second, so rate-limit per kind and play
  only what is on screen and not fogged.
- Reduce motion drops some effects in `collectFx`, so sounds must not depend on that filter.

### Lanternkeep
Lantern-lighting against the clock in a shadow-puppet theatre; warm twilight folk, tense near
nightfall.

**Done** (see `games/lanternkeep/AGENTS.md`, Sound). Differs from the plan: the storm's rain is a
running hat line in its music and there is no cricket ambience; a `late` part plays the last 10 s
of every dusk instead of a layer over the kind's tune; the moths' and bats' sounds come from the
scene comparing the state before and after `tick`, as the rules push no events for them.

**Music:** Music-box folk at about 108 BPM in A minor. Voices are a triangle lead like a music
box, a square pizzicato arpeggio and a soft shaker.
- Dusk: rises as `duskMs` runs down, with a ticking layer in the last 10 s.
- One flavour per night kind: fog muted, feast bouncy, storm with rain.
- Night panel, district choice and curse panels: a lullaby.
- A Great Festival fanfare and a game-over sting.

| Event | Sound | Where |
|---|---|---|
| Moth sent / tap queued | flutter whoosh / quiet pip | `game/state.ts:send` |
| Lantern lit or refilled | match strike and warm "fwoomp" | `state.ts:tick` |
| Close call saved | sparkle and coin | `closeCall` event |
| Cask dry | hollow clunk and buzz | `dry` event |
| Lantern burns out | soft fizzle | `state.ts:tick` |
| Gust warning / blown out / shielded | wind swell / gust and fizzle / "ting" | `state.ts:wind`, `blow` (`gust`) |
| Bat arrives, snuffs or driven off / chased | flap squeak, fizzle or bounce / whoosh and flee | `state.ts:raiders`, `chase` |
| Great Owl | distant hoot, then big whoosh | `state.ts:greatOwl` (`owl`) |
| Window calls / kept / runs out | door chime / chime and coin / dull fade | `state.ts:windows`, `answerCall` |
| Moth tired / swaps jars | sleepy blip / small flutter | `state.ts:tick`, `swapJar` |
| Nightfall payout | bell toll, then one coin per lit lantern | `state.ts:nightfall`; `scenes/GameScene.ts:payout` |
| Hearth lost | deep thud and minor chord | `nightfall` (`lostHearth`) |
| Buy / top up / rekindle | ka-ching / glug / fire swell | `state.ts:buy`, `topUp`, `rekindle` |
| Next dusk / move district / curse | evening chime / cart rumble / ominous pluck | `state.ts:nextDusk`, `moveTo`, `takeCurse` |
| Great Festival / game over | festive fanfare / sad sting | `nightfall` (`festival` / `over`) |

Notes:
- The owl and double gusts snuff several lanterns at once, so merge their fizzles.
- Ambience: crickets, with rain on stormy nights.

### Mapmaker
Fog-of-war island charting; calm, curious, a cartographer's desk.

**Done:** built in `games/mapmaker/src/audio.ts` as planned, played from `GameScene`; the
survey's sounds play in the scene (the sim has no audio), and its `AGENTS.md` lists them.

**Music:** Light exploring tune at about 92 BPM in F Lydian, with a triangle bass and a plucky
square lead.
- Surveying: one sparse variation per isle kind.
- Harbor, chart and atlas screens: a bustling loop.
- From the third isle, while the rival is there: an uneasy motif.
- A "page bound" jingle and a Royal Atlas fanfare.

| Event | Sound | Where |
|---|---|---|
| Survey a tile | pen scratch and blip, pitch by terrain cost | `game/sim.ts:survey` |
| Value pops / lookout sweep and tally | soft tick / sonar sweep, then ticks | `scenes/GameScene.ts:announce`, `startSweep`, `ageSweep` |
| Wreck / cave artifact / storm / riddle | creak and chime / sparkle / thunder / minor motif | `GameScene.ts:announceFinds` |
| Feature charted whole | bonus chime | `GameScene.ts:announceFeatures` |
| Dig: treasure / nothing | shovel, then fanfare / dull thud | `sim.ts:dig` |
| Pitch a camp | tent flap and peg | `sim.ts:pitchCamp` |
| Rival beats you to it | ominous two-note | `GameScene.ts:announceRival` |
| Return to port | ship's horn | `sim.ts:returnToPort` |
| Sell chart / milestone | coin cascade / extra chime | `sim.ts:sellChart` |
| Royal Atlas | grand fanfare | `GameScene.ts:showAtlas` |
| Buy / hire / commission | ka-ching / friendly blip / card flip | `sim.ts:buy`, `hire`, `pickCommission` |
| Set sail / theme switch / invalid tap | swell and horn / click / buzz | `sim.ts:setSail`; `GameScene.ts` |

Notes:
- One lookout can produce several finds at once, so play only the most important one.
- No sounds while a saved game is restored.

### Mazewright
**Done.** See the Sound section of `games/mazewright/AGENTS.md`: a pastoral tune in G (`calm`) for
building and the garden picker, a busier E minor `battle` part while a wave walks the maze, a
heavier `boss` part for the beetle queen, and `win` and `lose` stings. Effects are a rustle for a
hedge planted, a two-note build chime, a bow's swish, a cannon's thump, a frost shimmer, a pop for a
beaten foe, a low buzz for a foe that gets in, a horn per wave, a fanfare for a held wave and a
chewing scratch for the mole; a refused placement plays the shared `refuse` buzz. One sound per
shot, rate-limited, so a full maze never turns into noise.

### Ninefold
Number-placement puzzle in nine art styles; calm, tidy, a music box on a desk.

**Done** (see `games/ninefold/AGENTS.md`, Sound).

**Music:** A music-box tune at 84 BPM with a triangle lead.
- Menu and style picker: a sparse two-bar loop.
- Classic and daily boards: G major, light kick and hat.
- Delve floors: A minor, busier drums.
- Stings for a solved board and for a Delve run that ends.

| Event | Sound | Where |
|---|---|---|
| Pick a cell | soft tick | `scenes/GameScene.ts:onBoardTap` |
| Right digit / wrong digit | two-note pluck / low buzz (a falling buzz when it costs a heart, a bright drop when the Ward catches it) | `GameScene.ts:drain` (`placed`, `wrong`) |
| Pencil mark / erase | pencil scratch / rub | `GameScene.ts:enterDigit`, `onErase` |
| Hint | rising arpeggio | `GameScene.ts:drain` (`hint`) |
| Row, column or box finished | chime | `GameScene.ts:drain` (`unit`) |
| Style unlocked or picked / relic taken | sparkle / bright arpeggio | `GameScene.ts:drain`, `buildStyles` |

### Palisade
Low-poly fixed-hero siege defence with level-up cards; heroic medieval.

**Done.** Built as planned, with the boss waves on a song of their own (one tempo per song) and
every sound played from the scene (`scenes/BattleSounds.ts` compares the state before and after
each tick), so `game/` stays free of sound. No wind ambience. The level label moved into the left
end of the experience bar, clear of the corner buttons. `games/palisade/AGENTS.md` (Sound) lists
what plays where.

**Music:** Martial march at about 120 BPM in A minor, turning major for the win. Voices are a fife
lead, triangle bass and snare rolls.
- Breaks: a lighter loop.
- Waves: the full march.
- Boss waves: about 100 BPM over a low ostinato.
- Level-up pause: a held pad.
- Stings for game over and the win.
- The 2x speed switch doesn't change the tempo.

| Event | Sound | Where |
|---|---|---|
| Ranger volley | soft "thwip", one per volley | `game/sim.ts:shoot`, `launch` |
| Arrow hit / crit / blocked | tick / bright ping / clank | `sim.ts:arrowHit` |
| Fireball, oil pot | boom and crackle | `sim.ts:explode`, `burstOil` |
| Chain lightning | crackly zap | `sim.ts:lightning` |
| Guard stab / mage bolt, arcane | thud / sparkle | `sim.ts:guardsAct` |
| Foe dies / splits | pop, lower for big foes | `sim.ts:removeDead` |
| XP, orbs, streak | rising blips | `sim.ts:removeDead` |
| Level-up / card picked | arpeggio / confirm | `sim.ts:gainXp`, `pick` |
| Arrow Rain | whoosh, then patter | `sim.ts:loose`, `landVolleys` |
| Caltrops | metallic jingle | `sim.ts:strew` |
| Barricade hacked / breaks | wood chop on a timer / big crash | `sim.ts:moveEnemies` |
| Hire, train, fortify, repair, aim | coin and hammer / click | `sim.ts:hire`, `train`, `fortify`, `repair`, `setAim` |
| Omen accept / refuse | ominous chord / click | `sim.ts:decideOmen` |
| Boss rock, call, roar | whoosh and thud / horn / growl | `sim.ts:bossMoves`, `landRock` |
| Shaman heals | rising shimmer | `sim.ts:heal` |
| Wave start / cleared / relic / road choice | war horn / fanfare / sparkle | `sim.ts:step`, `clearWave`, `pickRoad` |
| Hero falls / siege lifted | falling sting / victory fanfare | `sim.ts:gameOver`, `clearWave` |

Notes:
- Barricade damage is continuous with no event, so the chop needs its own timer.
- Ambience: wind in the pines.

### Riftblade (planned against PR #378)
**Done.** Built on main after the heroes PR merged, as planned with these differences: the sim
gets no `s.sfx` queue; `games/riftblade/src/audio/cues.ts` plays everything by comparing the state
frame to frame (new entities by id, counts, phase). Each planet's song has its own calm part and
shares tense, boss and pad parts moved into its key; the hero select, star map and trader share one
90 BPM song. Elara and Triad-77 have their own shot and signature sounds. See
`games/riftblade/AGENTS.md`, Sound.

Survivor-style auto-attack roguelike in neon vector art; sci-fi and frantic.

**Music:** Space-opera chiptune at 150-160 BPM, one key per world: Dune in D minor, Swamp in E
minor with a swing, Ice in B minor and sparse, Lava in C minor and heavy.
- Hero select and star map: about 90 BPM.
- Trader: a shop ditty.
- Surround rings and elite arenas: a tense layer.
- A boss loop per world.
- Level-up pause: a pad.
- Victory and defeat stings.

| Event | Sound | Where |
|---|---|---|
| Soldier fire (pistols, spread, carbine) | tight "pew" / triple / alternating pitch | `game/sim.ts:primary`, `volley`, `bolt` |
| Soldier pool skills | grenade thump / drone buzz / call-in whistle and crash | `sim.ts:abilities`, `addBomb`, `bombs` |
| Knight attacks, one family per knight | Kael saber swish, Vharn boomerang hum, Oom wave pulse, Corvin spin hum, Veyl lightning crackle, Kresh staff whir, Joren 4-hit ticks with a ping on every 10th | `game/blades.ts:knightAttack`, `slash`, `throwAttack`, `ripple`, `spin`, `chain`, `orbitHits`, `flurry` |
| Signature move (Space) | one big sound per hero (Rally horn, Frag Out boom, Leap Strike slam, Deflect ring, Overload storm and so on) | `sim.ts:signature`, `blades.ts:knightSignature` |
| Knight pool skills | Blade: steel swishes; Current: soft swells; Hollow: distorted buzz and zaps | `blades.ts:knightAbilities` |
| Foe hit / killed | tiny tick / pop, pitch by kind | `sim.ts:damage`, `kill` |
| Explosions | noise boom, volume by size | `sim.ts:explode`, `detonate` |
| Hero hurt / dodge / barrier | harsh blip down / whoosh / glassy tink | `sim.ts:hurtHero` |
| Shard pickup | blips rising in a combo | `sim.ts:pickups`, `gainXp` |
| Level up / card / capstone or crossover | arpeggio / confirm / gold fanfare or purple shimmer | `sim.ts:tick`, `choose`, `raise` |
| Elite / chest / credits | warning horn / chime / coin | `sim.ts:director`, `openChest`, `take` |
| Surround ring closes in | siren sweep | `sim.ts:director` |
| Hazard warning, then eruption | rising beep / low boom | `sim.ts:addHazard`, `hazards` |
| Enemy bolts, boss attacks | low enemy pew / heavy thumps | `sim.ts:shoot`, `bossAttacks` |
| Boss appears / defeated | ominous stab / boom and victory jingle | `sim.ts:director`, `kill` |
| Star map, trader buy and reroll, event | blip / coin / whirr / chime | `game/voyage.ts:chooseNode`, `buy`, `reroll`, `chooseEvent` |
| Run won / lost | victory / defeat sting | `voyage.ts:afterClear`; `sim.ts:hurtHero` |

Notes:
- Up to 250 foes means hard rate limits and voice caps.
- The sim has no event list, so the plan adds a small `s.sfx` queue that the scene drains.
- Re-check this table against main once PR #378 is merged.

### Scrapyard Titans
Board auto-battler of junk robots; punchy, mechanical arcade.

**Music:** Industrial chiptune in E minor.
- Shop and planning: about 110 BPM.
- Fights: about 140 BPM.
- Draft carousel: its own variation.
- Scrap Rat chase: a frantic variation.
- Jingles for a round won, lost or drawn, plus match-won and eliminated stings.

| Event | Sound | Where |
|---|---|---|
| Buy / can't afford / reroll | clunky cash blip / buzz / slot whirr | `scenes/GameScene.ts:doBuy`, `doReroll` |
| Buy XP / level up / sell | rising blip / 4-note arpeggio / falling clink | `GameScene.ts:doXp`; `game/match.ts:gainXp`; `doSell` |
| Lock shop, speed | latch click | `GameScene.ts:toggleLock`, `toggleSpeed` |
| Place or move robot / star-up merge | metal clank / sparkle and power chord | `match.ts:moveUnit`, `merge` |
| Bolt a part on, item built | wrench ratchet / chime | `match.ts:equip` |
| Plan timer ending / FIGHT | tick-tock / horn and crash | `GameScene.ts:tick`, `goFight` |
| Melee / shot, shell, snipe | punch / pew, mortar thump, sharp crack | `GameScene.ts:consume` (`attack`, `proj`) |
| Damage, crit | small tick / bright clang | `consume` (`dmg`) |
| Ability per class | shield hum, ground slam, barrage rattle, charge ping, blink zip, repair ratchet | `consume` (`cast`) |
| Lightning / heal, shield, stun, dodge, revive | crackle / rising tone, hum, warble, whoosh, reboot chime | `consume`, battle events |
| Robot destroyed | scrap crunch | `consume` (`death`) |
| Commander skill | big whoosh | `GameScene.ts:doSkill` |
| Gold, orb | coin ding / sparkle | `consume` (`gold`) |
| Power card, draft pick | shimmer / confirm | `GameScene.ts:doAugment`, `tickDraft` |
| Round result / match over | jingle / end sting | `GameScene.ts:finishFight`, `afterResult` |

Notes:
- Other players' fights run without playback, so they make no sound.
- Fights at 2x speed with 16+ robots need rate limits.
- Done: see the Sound section of `games/scrapyard-titans/AGENTS.md`. Two songs, since the tempos
  differ (`PLAN_SONG` with calm and draft, `FIGHT_SONG` with battle, rat and the stings). Level-up
  is heard in the scene (`doXp`, `beginPlan`), not in `gainXp`; place, merge and equip in the
  scene's `doMove`, `doBuy`, `doEquip`. The plan timer ticks only in its last 3 seconds.

### Shrine Stack
One-button temple stacking at dusk; calm and mystical, tense as it leans.

**Music:** Slow tune at about 80 BPM in D Dorian, with a triangle drone and a soft square lead
with echo. The tempo creeps up each tier.
- Patron pick and shop breaks: a harp-like loop.
- Gilded tier 10: a brighter arrangement.
- Endless sky: an airy variation.
- A crowning fanfare and a falling sting.

| Event | Sound | Where |
|---|---|---|
| Drop the stone | whoosh, then falling pitch | `game/state.ts:drop` |
| Land with a cut / perfect | thud and crack with rattle / clean thud and bell | `placed` event |
| Perfect chain regrows | rising shimmer | `regrown` |
| Tier balanced / wobbly | 3-note chime / flat "meh" | `tier` |
| Trial passed / failed | sparkle / muted blip | `trial` |
| Tier topples | rumble and tumbling cascade | `toppled` |
| Miss caught / miss | whoosh and "saved" chime / crash and sting | `missed` |
| Swap reserve | quick swish | `swapped` |
| Patron / blessing / reroll / buy | gong / choir chord / shuffle / coin | `patron`, `chooseBlessing`, `rerolled`, `bought` |
| Material / curse | stone click / dissonant pluck | `chooseMaterial`, `toggleCurse` |
| Build on, keep building / crowned | rising whoosh / triumphant fanfare | `buildOn`, `keepBuilding`; `crownTemple` |

Notes:
- Ambience: wind in the endless sky that follows the gust strength.

**Done** (see `games/shrine-stack/AGENTS.md`, Sound). Parts: `calm`, `gilded`, `sky`, `break`
(patron pick and breaks), stings `crown` and `fall`. Differs from the plan: the tempo stays at 80
(the engine plays a song at one tempo), and the wind is a one-shot `gust` whenever a new stone gets
a gust rather than a steady ambience.

### Space Wars
Five-faction real-time strategy on a star map; pulpy 1970s sci-fi.

**Done** (see `games/space-wars/AGENTS.md`, "Sound"). As built: one song at 120 BPM with the parts
`menu` (picker), `calm` (a half-time loop rather than 104 BPM), `battle` (while an attack alert is
live), `boss` (the last-stand pact) and the stings `win`, `lose` and `end` (watch mode). The world
reports `cue` events and the scene plays them. Added since this plan: an alarm per new attack
alert, a whoosh on jumping to one, and a flag sound for the rally point. Left out: the board's
own "static and beep" (the contract jingle or error tone plays as it opens), the faction motifs
and the ambient hum. The build and train rows start at x 64, clear of the corner buttons.

**Music:** Synth space opera at about 120 BPM in E minor, with a pulse lead with vibrato, a
buzzy bass and toms.
- Opening economy: a slower loop at about 104 BPM.
- Combat (player under fire, raids, last stand): a driving loop.
- Picker and campaign map: their own theme.
- Optionally, a motif per faction.
- Victory and defeat stings.

| Event | Sound | Where |
|---|---|---|
| Laser shot | falling square pew, by faction | `game/world.ts:shoot` |
| Explosion | noise burst and thump, size by radius | `world.ts:wreck`, splash, `updateMines` |
| Select / move / attack / fall back | two blips / "roger" chirp / aggressive chirp / falling chirp | `scenes/GameScene.ts:tapMap`, `onUp`, `press` |
| Place building / done | clank / completion chime | `world.ts:build`, `updateBuilding` |
| Queue unit or research / unit warps in | blip / rising zap | `world.ts:train`, `research`, `updateBuilding` |
| Research done, veteran or ace | upgrade arpeggio | `world.ts:updateResearch`, `credit` |
| Invalid action | buzz | reasons from `build`, `train`, `research`, `pickContract` |
| Crystal gain | sparkly pickup | `gain` events |
| Contract board / picked / done / failed | static and beep / stamp / jingle / error tone | `world.ts:openBoard`, `startContract`, `updateContract`, `failContract` |
| Beacon or derelict won / lost | rising / falling tone | `world.ts:updateBeacon`, `updateDerelict` |
| Truce offered, made, broken / tribute | bleep / chord / alarm | `world.ts:considerTruce`, `acceptTruce`, `updateTruce`, `bribe` |
| Pact raid, convoy hunted | klaxon | `world.ts:signPact`, `updatePact`, `launchConvoy` |
| Flagship unlocked / launched / lost | brass chord / deep roar / mournful horn | `world.ts:updateFlagship`, `removeDead` |
| Hub falls / victory / defeat | multi-explosion / fanfare / sting | `world.ts:removeDead`, `update` |

Notes:
- Rivals call `build`, `train` and `research` too, so UI sounds come from the scene only.
- Cull fights hidden in fog or off screen.
- Watch mode runs several steps per frame, so play the music, a thinned-out battle and the
  winner fanfare.
- Ambience: a low space hum.

### Tiny Kingdom
Turn-based tile placing; a calm wooden toy set.

**Music:** Bouncy pastoral at about 100 BPM in G major, with a music-box pulse lead and a
triangle bass.
- One variation per season (`seasonFor(round)`).
- A short omen motif.
- Stings for the kingdom finished and a new best.

| Event | Sound | Where |
|---|---|---|
| Pick a tile / place a building | wooden click / "tok" by kind | `game/state.ts:select`, `place` |
| Score popups | rising blips for gains, low for losses, staggered | `scenes/GameScene.ts:popup` |
| Invalid tap | soft "bonk" | `GameScene.ts:tapAt` (`place` returns null) |
| Merge into a manor | "thunk-ding" | `state.ts:merge` |
| Clear a wood / market trade / undo | chop and rustle / coin jingle / reverse swoosh | `state.ts:clear`, `trade`, `undo` |
| Decree fulfilled | regal 3-note fanfare | `GameScene.ts:decreePaid` |
| Round goal, gift, new season | arpeggio / confirm / season motif | `state.ts:settle`; `GameScene.ts:takeGift`, `announceRound` |
| Flood / storm | water sweep / thunder | `GameScene.ts:tapAt` (`struck`) |
| Kingdom finished, stars, new best | ending jingle, tally ticks, star chimes | `GameScene.ts:gameEnded`, `state.ts:end`, `finish` |
| Islands keypad | key clicks | `GameScene.ts:keyIn` |

Notes:
- Nothing here is high-frequency. Play hover ticks only when the cell changes, or not at all.
- Done: `src/audio.ts`, with the song's parts named after the seasons (`spring`, `summer`,
  `autumn`, `winter`) and stings `omen`, `finished` and `best`; no hover ticks. The game's
  `AGENTS.md` lists where each sound plays.

### TinctureTinker
Match-3 potion brewing in Art Nouveau style; cosy and whimsical.

**Done** (see `games/tincture-tinker/AGENTS.md`, Sound): as planned, in `src/audio.ts`. The stings
are `sold1`-`sold3` (one chime per star), `rank` (also a passed exam, with a seal stamp), `crown` and
`fail`; the tense part is a D minor turn of the waltz. The hint line (caption) now sits right-aligned
under the order label, clear of the corner buttons.

**Music:** Music-box waltz at about 90 BPM in F major, with a soft triangle lead, a square
arpeggio and no drums.
- Royal commissions and exams: a statelier variation.
- Few moves left: a tenser variation.
- Stings for a potion sold (one chime per star), out of moves and the royal title.

| Event | Sound | Where |
|---|---|---|
| Tile picked | soft wooden tick | `scenes/GameScene.ts:pointerDown` |
| Swap that matches / slides back | two-note slide / dull "bonk" | `GameScene.ts:swap` |
| Match and each cascade | glassy pop, rising per cascade | `GameScene.ts:playStep` (`cleared`) |
| Ingredient flies to its row | tiny "tink" | `playStep` (`flying`) |
| Catalyst or Bloom made / fired | shimmering arpeggio / whoosh sweep, bigger burst for 5x5 | `playStep` (`brewed`, `rows`, `areas`, `bursts`) |
| Jar opened, resin melted, mould scrubbed / mould spreads | cork pop, sizzle, scrub / squelchy wobble | `playStep` |
| Forbidden ingredient | buzz | `st.penalty` |
| Board shuffled | rattling sweep | `playStep` (`shuffled`) |
| Customer served / next stage | bell ding / two chimes | `playStep` (`served`, `stage`) |
| Stir, Sift, Pestle, Funnel | swirl, rattle, thunk, glug | `GameScene.ts:useTool`, `siftRow`, `usePestle`, `pickFunnel` |
| Sold / out of moves / rank, exam, title | cadence / falling sting / fanfare, seal stamp | `GameScene.ts:settle`, `showSold` |
| Buy upgrade or herb | coin clink | `GameScene.ts:buy`, `buyHerb` |
| Idle hint | very soft twinkle | `GameScene.ts:updateHint` |

Notes:
- Play one sound per cascade step, not per tile.
- Fire sounds in the animation queue's `start` callbacks so they stay in sync.

### Wyrmrail
**Done.** See the Sound section of `games/wyrmrail/AGENTS.md`. Differences from the plan below: the
sim stays free of audio, so the scene plays the player's taps and `GameSounds` compares the state
each frame for the rest; the busy part is sixteenths at 100 BPM (one tempo per song); there is no
tunnel muffling (no wyrm sound plays inside a tunnel).

Isometric railway builder with a dragon train; pastoral, mild time pressure.

**Music:** Fiddle-like folk at about 100 BPM in G major pentatonic, with a pulse lead, triangle
bass and brushes. An arpeggio layer joins once the charter is picked.
- Charter offer (paused): a calmer loop.
- An order running low or a hazard warning: a busier layer at about 116 BPM.
- Festival round: a festive loop.
- Gold, silver and bronze medal fanfares, and a minor game-over sting.

| Event | Sound | Where |
|---|---|---|
| Lay track per tile / take up | wooden "tok", by terrain / reversed tok and coin | `game/sim.ts:buildTrack`, `removeTrack` |
| Throw a switch / wyrm stops for one | click-clack / slower clack and grumble | `sim.ts:throwSwitch`, `stopForSwitch` |
| Send an order / new order | rising blip / two-note bell | `sim.ts:dispatch`, `addOrder` |
| Goods loaded / delivered | 3-note arpeggio / coin jingle | `sim.ts:moveWyrm`, `arrive` |
| Workshop upgrade / wyrm eats | anvil ting / munch chomps | `sim.ts:makeGoods`, `arrive` |
| Order out of time / village loses faith | falling "wah-wah" / sour blip, deeper thud | `sim.ts:failOrder`, `tickMoods` |
| Washout or rockfall warning / strike | alarm ping / splash or rumble | `sim.ts:tickHazard`, `strikeHazard` |
| New round, village joins / charter shown, picked | rising fanfare / parchment swish, stamp | `sim.ts:nextRound`, `pickCharter` |
| Upgrade or depot / second wyrm wakes | ka-ching / dragon roar | `sim.ts:buyUpgrade`, `buyDepot` |
| Courier / gifts delivered | whistle / happy chime | `sim.ts:sendCourier`, `arrive` |
| Game over / festival won | minor sting / medal fanfare | `scenes/GameScene.ts` (phase `over` / `won`) |

Notes:
- Dragging lays many tiles, so step the "tok" pitch up along the drag.
- Failed taps are silent today, so the buzz hooks where the scene calls `buildTrack`, `dispatch`
  and `buyUpgrade`.
- Muffle the sound in tunnels.
