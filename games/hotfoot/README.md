# Hotfoot

An auto-runner prototype built with [Phaser 4](https://phaser.io), TypeScript and Vite, part of
the [game hub](../../README.md).

A knight runs along an old road at dusk and never stops, painted as a gothic miniature on a vellum
page: a sky diapered in lapis and madder, a gold-leaf moon and coins, inked outlines, an
illuminated initial on the stage's name and a margin of leafy scrollwork under the road, where a
rubric caption says what the knight is about. Spikes, pits and fire vents lie in the
road, spiked logs hang over it on chains, goblins walk it and bats swoop along it, and old castle
walls raise stretches of it into ledges: jump the spikes, pits, flames and goblins and up onto the
ledges, slide under the logs and bats, and pick up the coins on the way. Every stage ends at a checkpoint, a banner by a campfire, where the run waits on a choice
of two boons. The knight keeps every boon until they fall, and each stage after runs a little faster
with the traps a little closer together. Coins taken in a row build a streak that multiplies their worth, a wayside shrine on each stage
from the second trades coins for a heart, and a run track under the top band shows how far the
knight is from the next banner and from the best run. Each stage after the first runs on its own
ground with its own rule (a frozen pass, a fen, a windy pass), and every fifth stage a Gatekeeper
bars the road. Some checkpoints offer a cursed boon, a gift with a price, and two boons held
together unlock a hidden bonus. From the second checkpoint the knight also picks the next road, the
bold High Road or the safer Low Road, and from stage 2 a herald sets a dare on each stage that pays
coins and a third boon card. Every seventh stage a rockfall rolls in behind the knight, and at
1500 m the dragon of the Dragon's Keep waits to be beaten for a lasting crown, after which the run
goes on harder, beyond the Keep along the Sky Road of gusts and falling clouds. Coins are banked when
the knight falls, and buy back the boon you missed at the last checkpoint, lasting upgrades in the
armoury, or a second knight to run as: the squire or the heavy knight. Your best run plays back as a
faint ghost beside you, to race. A companion bought in the armoury runs along: an owl that grabs
coins out of reach, a hound that barks before a trap, or a fox that takes a hit for you once a stage.
A daily course, the same for everyone on the day, and a weekly road, the same all week with two set
boons, keep their own best distances, and ten hand-made challenge courses pay three stars each,
every star of them winning a pair of gold boots.

![The knight leaping a flame on stage 3, a wayside shrine and a goblin ahead](cover.png)

![The knight jumping on the first stage, with a hanging log ahead](docs/screenshots/playthrough-0-jump.webp)

## How to play

| Control | Action |
| --- | --- |
| Tap the top half of the screen or the Jump button, or Space / Up / W | Jump (again in the air with Second Leap) |
| Tap the bottom half of the screen or the Slide button, or Down / S | Slide; in the air, drop fast and slide on landing |
| Tap a card | Take that boon at a checkpoint |
| Tap a road card | From stage 3: pick the road the next stage runs on, once the boon is taken |
| Run again | After a fall: a new run from the start, with no boons (or the one bought on the game-over panel) |
| Courses | After a fall: the daily course, the weekly road and the ten challenge courses |
| Try again | After a challenge course: run the same course again |
| Armoury | After a fall: spend banked coins on lasting upgrades, knights and companions |

A hint on the first stretch of the run shows where to tap. On a touch screen, round Slide and Jump
buttons in the bottom right of the margin do the same while the knight runs.

![The Slide and Jump buttons](docs/screenshots/action-buttons.webp)

![Where to tap](docs/screenshots/controls.webp)

1. **Traps**: spikes and pits are jumped, blades are slid under. A fire vent only burns part of the
   time, flaring after a short sputter; jump it, or run over it while it is out.
2. **Foes**: goblins walk back and forth along their stretch of road and are jumped; bats fly in at
   head height and are slid under. Landing on either from above knocks it out for a coin and
   bounces the knight back up.
3. **Ledges**: raised stretches of road to jump up onto, and drop off the far end of. Running into
   the side of one hurts, and the knight scrambles up it. Later stages have steps: a low ledge
   followed by a taller one.
4. **What turns up**: the first stage shows spikes, a blade, a goblin and a ledge once each before
   mixing them up with pits. Fire vents and bats join from stage 2, and steps and tall ledges from
   stage 3.
5. **Hearts**: the knight starts with three. A trap, a foe or a ledge's side takes one (and ends the
   coin streak), and the knight blinks for a moment in which nothing can hurt them. Falling into a pit throws them back out. **The run is over when the
   last heart is gone.**
6. **Coins** lie in arcs over the spikes, pits and fire vents, in rows under the blades and bats,
   high over the goblins and along the tops of the ledges. A stomped goblin or bat drops one too.
7. **Coin streak**: every coin taken without a hit adds to the streak. Each 10 coins in a row raise
   its multiplier by one, up to x5, and each coin after that is worth the multiplier (with Golden
   Greed, its value times the multiplier). The chip by the stage's name shows the multiplier and how
   many coins to the next one ("7 to x4"); a coin worth more than one pops its value ("+3") over the
   knight, and from x2 a trail of gold stars follows them. **Any hit resets the streak**, a hit the
   Aegis shrugs off included.
8. **Wayside shrines**: from stage 2, a little chapel with a green heart stands on the road once a
   stage, under a scroll reading "Slide in: 15 coins = 1 heart". Slide into it to trade 15 of the
   run's coins for a heart, if you have them and are missing a heart; otherwise it says why not
   ("Hearts full" or "Needs 15 coins"). Jump or run past it to keep the coins for the shop.
9. **Run track**: the strip under the top band is the run so far, from 0 m: a banner every 100 m
   (gold once passed), the knight's marker, and a madder ghost flag at the best run. It reads
   "Next banner N m" on the left and the best distance on the right, "New best!" once past it.
10. **Checkpoints** come every 100 m. The run waits while two different boons are offered.
11. **Stages** speed up from 260 to at most 480 pixels a second, the room between obstacles shrinks,
   and goblins and bats get quicker.
12. **Ground**: the first stage is the old road. After it each stage has its own ground and rule,
   named as it begins and in the tag right of the run track:

   | Ground | Rule |
   | --- | --- |
   | The Frozen Pass (stages 2, 8, 11...) | Slides last 60% longer, and each landing skids for a moment: a jump tapped during the skid comes as it ends. Snow falls. |
   | The Fen (stages 3, 6, 9...) | Jumps go 20% lower. |
   | The Windy Pass (stages 4, 7, 13...) | A headwind slows the knight to 70% while in the air, so jumps fall shorter. |

13. **The Gatekeeper** bars the road on every fifth stage. It keeps ahead of the knight, rolling
   barrels down the road (jump them) and throwing axes at head height (slide under them), then tires
   and stands, panting: jump onto its helm to stomp it. Running into it costs a heart. After each
   stomp it runs ahead and throws faster. Three stomps beat it for 25 coins, and the stage's
   banner stands a little way past it. Its stomps left show as three diamonds in the tag.
14. **Cursed boons**: from the second checkpoint, the second card is sometimes cursed, edged in
   madder. Each gives something big and takes something away (see the table below). They are never
   for sale in the shop.
15. **The armoury**: on the game-over panel, "Armoury" opens a list of lasting upgrades bought with
   banked coins. Every ordinary run after starts with them; the daily course doesn't, so it stays
   the same for everyone. A fall banks only the coins earned on the run, not the purse's.

   | Upgrade | Levels | Prices | What each level does |
   | --- | --- | --- | --- |
   | Iron Heart | 2 | 60, 150 | One more heart |
   | Lodestone Charm | 3 | 40, 100, 200 | Coins fly in from a little further off |
   | Squire's Purse | 2 | 30, 80 | Start with 10 more coins |

16. **Daily course**: "Daily course" in the Courses panel (opened from the game-over panel) starts a run whose course and boon
   offers are drawn from the date, the same for everyone that day. It starts bare, without the
   armoury or a bought boon (which waits for the next ordinary run), so everyone runs it alike. Its
   best distance is kept apart from the ordinary best, and the tag says "Daily" while it runs.

17. **Forked roads**: from the second checkpoint, once the boon is taken, two road cards come up for
   the next stage (not for a Gatekeeper's or the dragon's stage). **The High Road** has more coins
   (five in each arc and row, a longer row on the lead-in), another goblin and bat in the mix,
   obstacles 40 px closer together, no shrine, and a streak cap of x7 instead of x5. **The Low
   Road** keeps the usual mix with obstacles 40 px further apart and has the wayside shrine. The tag
   right of the run track names the road.
18. **The herald's dare**: from stage 2, each ordinary stage opens with a dare in its title, shown
   with its progress in the strip under the tag: stomp 2 foes, take no hit, take 20 coins, or reach
   a x3 streak, going round in that order (stage 2 is the stomp, stage 3 no hit, and so on). Meeting
   it pays 20 coins on the spot ("Dare met!") and puts a **third boon card** on the stage's
   checkpoint. A no-hit dare is met at the banner, and lost to any hit, a blocked one included.
19. **Boon pairs**: some boons held together unlock a hidden bonus, hinted at on their cards
   ("Pairs with Second Leap: ...", in green once the other half is held) and announced when the
   pair completes:

   | Pair | Boons | Bonus |
   | --- | --- | --- |
   | Falcon's Glide | Winged Boots + Second Leap | The knight falls at half the pull of the ground, so every leap carries further |
   | Goblin's Hoard | Golden Greed + Lodestone | A stomped goblin or bat bursts into three coins instead of one |
   | Bulwark | Aegis + Shadow Cloak | A hit the shield shrugs off knocks every foe, barrel, axe, fire and tail lash within 220 px ahead off the road |

20. **The rockfall**: on every seventh stage (7, 14, 21...) a fall of boulders rolls in behind the
   knight, 240 px back. It keeps their pace and creeps up 10 px a second, and gains 90 px on every
   hit and 45 px on every skid on the Frozen Pass. If it catches the knight it costs a heart and
   falls back to where it started. The tag reads "Rockfall!" and the title warns of it.
21. **The Dragon's Keep**: the first stage that begins at or past 1500 m is the dragon's, on the
   old road with no road choice before it. The dragon keeps ahead like the Gatekeeper, breathing
   gouts of fire that roll along the road (jump them) and lashing its tail at head height (slide
   under it), then tires and lowers its head: stomp it three times to beat it for 60 coins, a
   lasting **crown** (worn on the knight's helm in every run after, and named on the game-over
   panel) and the stage's banner a little way on. **The run then goes on harder**: 60 px/s faster
   from that moment and on every stage after, with obstacles 50 px closer together.
22. **Beyond the Keep: the Sky Road.** Every ordinary stage after the dragon runs on the Sky Road,
   among the clouds (a Gatekeeper still bars the road on every fifth stage). There are no stone
   ledges, pits or fire vents there. Instead the road breaks into **gaps in the clouds**, 560 to
   680 px wide, too wide for one jump: a cloud floats over each one, so jump onto it and leap off
   again, since half a second after you land it gives way and falls, taking you with it if you are
   still on it. And every 4.2 seconds a **gust** blows at the knight's back for 1.3 seconds (streaks
   of wind gather first): the knight runs 30% faster and floats in the air, with only 70% of the
   pull, so a jump in a gust can clear a whole gap. The tag reads "Gust!" while it blows.
23. **A second knight**: the armoury's Knights row unlocks two more knights with banked coins, and
   chooses who runs the ordinary runs from then on (the daily course is always the knight's). Each
   keeps their own best distance and their own ghost.

   | Knight | Price | What sets them apart |
   | --- | --- | --- |
   | Knight | - | The knight everyone starts with |
   | Squire | 120 | Jumps again in the air (three jumps with Second Leap), but has a heart fewer (2 on Normal) |
   | Heavy knight | 160 | Smashes the goblins and bats he runs into (each counts as a stomp and drops its coin), but jumps 20% lower |

24. **The ghost runner**: the best ordinary run of each knight is kept, and on every ordinary run
   after it plays back as a faint, pale ghost of that knight, where that run was after as long a time
   running, jumping and sliding where it did. A pale ring on the run track marks it too. It goes once
   its run has ended; outrun it and the game-over panel says your ghost will run this one next time.
25. **Companions**: the armoury's Companions button opens a panel of three pets, each bought and
   then trained with banked coins. One runs with the knight on every ordinary run (tap "Take along";
   "Leave at home" runs alone); the daily course, the weekly road and the challenge courses are run
   without one.

   | Companion | Prices | What it does | Levels |
   | --- | --- | --- | --- |
   | Owl | 50, 100, 160 | Flies above the knight and swoops on a coin they pass out of reach, so it flies in | Reaches 50, 90, 140 px above or below the knight |
   | Hound | 40, 80, 130 | Runs at the knight's heels, barks at each trap as it comes within reach and marks it with a madder diamond on the road | Barks 380, 500, 640 px ahead |
   | Fox | 70, 130, 200 | Takes a hit for the knight once a stage, after the Aegis: no heart lost (a gold ring shows while it is ready) | Level 2 keeps the streak through it, level 3 takes two hits a stage |

26. **Challenge courses**: the Courses panel lists ten short courses laid out by hand, each a fixed
   row of traps on its own ground and at its own pace, from the Meadow Path to the Gauntlet. They
   are run bare, from three hearts (on Normal) to a finish banner, with coins drawn in from a little
   further off (as with a rank of Lodestone) so a good leap can take a whole arc. Each pays up to
   three stars: reaching the banner, reaching it without a hit, and reaching it with every coin on
   the course. The panel shows the stars won on each; **every star of all ten wins the gold boots**,
   worn by every knight in every run after. A challenge course banks no coins, and "Try again" on
   its panel runs it again.
27. **The weekly road**: "Weekly road" in the Courses panel starts a run drawn from the week's seed
   (ISO weeks, from Monday), the same for everyone all week, that starts with two set boons named on
   the panel. Run it as often as you like; it starts bare otherwise, like the daily course, and
   keeps the week's best distance, shown on the panel and on the game-over panel. The tag reads
   "Weekly" while it runs.

   The best distance, the banked coins, any boon bought, the armoury, the day's best on the
   daily course, the crown, the knights unlocked and chosen with their bests, each knight's
   ghost, the companions, the week's best on the weekly road and each challenge course's stars
   are saved between runs.

![A streak at x3: the chip, a "+3" pop and the trail of gold stars](docs/screenshots/streak.webp)

![A wayside shrine ahead, under its scroll](docs/screenshots/shrine.webp)

![Sliding into the shrine: 15 coins for a heart](docs/screenshots/shrine-heal.webp)

![The run track at 392 m: the next banner 8 m on, the ghost flag of the best run at 412 m](docs/screenshots/track.webp)

![Sliding under a blade, with a pit ahead](docs/screenshots/slide.webp)

![A goblin walking the road](docs/screenshots/goblin.webp)

![Stomping a goblin](docs/screenshots/stomp.webp)

![Jumping up onto a ledge](docs/screenshots/ledge.webp)

![A fire vent flaring](docs/screenshots/flames.webp)

![A bat flying in](docs/screenshots/bat.webp)

![Steps up to a tall ledge](docs/screenshots/steps.webp)

![The checkpoint](docs/screenshots/checkpoint-flag.webp)

![Stage 2 opens on the Frozen Pass: snow, a pale icy road and its title](docs/screenshots/ice-stage.webp)

![The Fen: reeds and puddles on a muddy road](docs/screenshots/fen-stage.webp)

![The Windy Pass: gusts blowing in while the knight is in the air](docs/screenshots/wind-stage.webp)

![The Gatekeeper rolls a barrel at the knight](docs/screenshots/gatekeeper-throw.webp)

![The Gatekeeper tires, and the knight comes down on its helm](docs/screenshots/gatekeeper-stomp.webp)

![The Gatekeeper beaten](docs/screenshots/gatekeeper-beaten.webp)

![A daily course under way](docs/screenshots/daily-course.webp)

![Choosing the road for stage 3](docs/screenshots/forked-roads.webp)

![Stage 3 on the High Road: its title names the road and the herald's dare, shown under the tag](docs/screenshots/high-road.webp)

![Stage 4 on the Low Road, with a pair just completed](docs/screenshots/low-road.webp)

![The rockfall close behind on stage 7](docs/screenshots/rockfall.webp)

![The dragon breathes fire along the road and lashes its tail](docs/screenshots/dragon-fire.webp)

![The knight bounces off the dragon's head, and it flies ahead](docs/screenshots/dragon-stomp.webp)

![The dragon beaten: the crown on the knight's helm](docs/screenshots/crowned.webp)

![The heavy knight leaps off a cloud over a gap on the Sky Road as a gust blows](docs/screenshots/sky-road.webp)

![The ghost of the best run leaps a flame behind the knight](docs/screenshots/ghost-runner.webp)

![The Companions panel: the owl, the hound and the fox](docs/screenshots/companions.webp)

![The hound at the knight's heels has marked the spikes and the log ahead; the knight wears the gold boots](docs/screenshots/companion-hound.webp)

![The Courses panel: the daily course, the weekly road and the ten challenge courses with their stars](docs/screenshots/courses.webp)

![A challenge course cleared with all three stars](docs/screenshots/challenge-cleared.webp)

### Boons and the coin shop

| Boon | Ranks | What it does |
| --- | --- | --- |
| Hearty Ale | 3 | One more heart, and one heart back |
| Winged Boots | 3 | Jump 12% higher |
| Second Leap | 1 | Jump again once in the air |
| Aegis | 2 | Shrug off the first hit after each checkpoint (two with rank 2) |
| Lodestone | 3 | Coins fly to the knight from further off |
| Golden Greed | 3 | Each coin is worth one more |
| Oiled Greaves | 2 | Slides last 30% longer |
| Shadow Cloak | 2 | Stay unhurt 50% longer after a hit |
| Field Dressing | any | Two hearts back; only offered once fewer than two other boons are left |
| Cursed Gold (cursed) | 1 | Coins are worth double, but one heart less |
| Glass Greaves (cursed) | 1 | Slides last 60% longer, but you stay unhurt half as long after a hit |
| Iron Oath (cursed) | 1 | Shrug off two more hits after each checkpoint, but jump 15% lower |

![Two boons at a checkpoint](docs/screenshots/playthrough-1-checkpoint.webp)

![A cursed boon beside an ordinary one](docs/screenshots/cursed-boon.webp)

![Three cards after a met dare, with the pair hints](docs/screenshots/dare-met-three-cards.webp)

![After a fall at the Dragon's Keep, crowned](docs/screenshots/game-over-crowned.webp)

![A hit](docs/screenshots/hit.webp)

![After a fall: the shop, the armoury and the courses](docs/screenshots/game-over.webp)

![The armoury, with its Knights row and the way to the companions](docs/screenshots/armoury.webp)

**The coin shop.** Coins collected in a run are banked when the knight falls. On the game-over panel,
the boon you missed at the last checkpoint (a card you did not tap, one that can be sold if there is one) is for sale for 30 coins. Buy
it and the next run starts with it at one rank and full hearts. One purchase at a time, and Field
Dressing and cursed boons are never for sale. Nothing is for sale until the run has reached a
checkpoint. The armoury, also on the game-over panel, spends the same bank on lasting upgrades.

The difficulty, set on the hub page's Settings, changes one thing: the knight starts with 5 hearts on Easy and 2 on Hard.
With Reduce motion on, the knight fades instead of blinking after a hit, the shield ring holds still,
the coin pops stay where they appear instead of rising, the streak's trail of stars is not drawn,
the Gatekeeper fades instead of flashing when stomped, and the snow, gusts, boulders, rockfall dust,
fire vents, dragon fire and bats hold still, and a cloud about to fall doesn't tremble.

## Running locally

`npm run dev` at the repo root, then open `/games/hotfoot/` (or pick Hotfoot on the hub
page).

## Playthrough test

`e2e/playthrough.spec.ts` plays the first stage in headless Chromium: it checks the new run, taps
the top half of the screen to jump each spike row, pit and goblin and up onto each ledge, and the
bottom half to slide under each blade, as they come up, and checks that the knight reached the
checkpoint without a hit, jumping, sliding, getting past a goblin, running along a ledge and picking
up coins on the way, on one unbroken streak whose multiplier paid out exactly as the rules say.
There it checks that the run waits on two different boons, taps the first card, and checks that the
boon was taken and the faster second stage has begun on the Frozen Pass, with a wayside shrine on it. Like the other games' tests it owns the game clock and plays at 4x speed
(`PLAYTHROUGH_SPEED`). The **Playthrough Hotfoot** workflow
(`.github/workflows/playthrough.yml`) runs it on every PR that touches this folder or its
workflow, and uploads the video and screenshots as the
`playthrough-hotfoot` artifact.

```sh
npx playwright test --project hotfoot
```

## Code layout

All paths are inside `games/hotfoot/`.

- `src/game/`: the rules in plain TypeScript with no Phaser dependency. `state.ts` holds the run,
  the knight's and the traps' sizes and works out the knight's numbers from the boons taken,
  `course.ts` lays out each stage's traps, foes, ledges, coins and shrine by its road, its dare
  and its rockfall (or the Gatekeeper or the dragon), `boons.ts` is the table of boons (cursed ones
  too), `pairs.ts` the boon pairs, `boss.ts` moves the Gatekeeper and the dragon and their throws,
  `armoury.ts` is the table of lasting upgrades, `knights.ts` the knights to run as, `pets.ts`
  the companions, `challenges.ts` the challenge courses and their stars, `weekly.ts` the weekly
  road's week and boons, `ghost.ts`
  records the run and plays back the ghost, `sim.ts` moves the run on (foes, ledges, stomps,
  the ground's rules, the Sky Road's gusts and clouds, the bosses, the rockfall, the dares, the
  pairs' bonuses, the coin streak and shrines included), jumps, slides, takes boons and roads and
  sells the missed boon, the armoury's levels, the knights and the companions, and `save.ts` keeps
  the best distance, the banked coins, any boon bought, the armoury, the daily course's and the
  weekly road's bests, the crown, the knights, the ghosts, the companions and the challenge stars.
- `src/scenes/`: `BootScene` bakes textures, `GameScene` draws the run and wires taps and keys to
  the rules, `layout.ts` says where things are drawn.
- `src/art/`: all the art, painted in code on 2D canvases at startup, in the manner of an
  illuminated manuscript: flat colours with ink outlines, white highlights and gold leaf, using the
  helpers and pigments in `ink.ts`. `scenery.ts` paints the vellum page and its margin, the sky,
  crags and trees (and the cloud banks beyond the Keep), the road on each ground, the gaps in the
  clouds and the clouds over them, the ledges, the traps, the coins, the checkpoint
  banner, the wayside shrine and the miniature's frame; `knight.ts` the poses of each knight (and
  again in gold boots); `pets.ts` the owl, the hound and the fox; `foes.ts`
  the goblin, bat, Gatekeeper and its barrel and axe, the dragon and its fire and tail lash, and
  the rockfall's boulder; `icons.ts` the boon, road and armoury icons and hearts; `hud.ts` the top
  band, the illuminated initial, the streak chip, the run track's strip, the stage's tag, the
  dare's strip, the vellum panels and the buttons.
- `src/ui/`: the boon and road cards and buttons.

Adding a boon is an entry in `src/game/boons.ts`, its effect in `stats` in `src/game/state.ts`, and
an icon in `src/art/icons.ts`. Adding a trap is a kind in `state.ts` (with its height in
`TRAP_SPAN`), a piece in `course.ts` (`planOf` and `piecesOf`) and its art in `src/art/scenery.ts`.
