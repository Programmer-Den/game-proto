# Tiny Kingdom

A tile-placing puzzle prototype built with [Phaser 4](https://phaser.io), TypeScript and Vite,
part of the [game hub](../../README.md).

Build a kingdom on a small island of grass, lakes and forests, laid out at random for every new
kingdom (the panel shows its island number). It looks like a wooden toy set: painted beech tiles
in a walnut tray, block houses, peg trees and towers with flags on dowels. Each round hands out a
pouch of farms, houses, towers and a road, and every turn draws three of them: you place one and
the others go back. Every building scores against its neighbours, so where it goes matters more
than what it is. Each round also brings a royal decree, a side goal that pays a crown, a season
that makes some buildings score double, and reaching the round's goal earns a royal gift, such as a
new building: the windmill, the market, the harbor, the lumber camp or the temple. From round 3 an omen warns of
what the next round brings. Every island has a castle, and the buildings joined to it by a chain of
buildings and roads pay a bonus when the kingdom is finished. Two houses side by side can merge into
a manor; a lumber camp can clear a wood; a market can trade tiles. Play a random island, type in an
island's number, try the island of the day, or work through the eight-island campaign for up to
three stars each. Run out of tiles or room and the kingdom is finished; then sail on to the next
island of a chain, cut into by the sea, with a building found only there, the cargo your harbors
ship and a trade bonus for its own. Kingdom feats, such as a farm with three lakes beside it, unlock
new paints for the tiles. Round 3 brings each kingdom its wonder, a 2x2 cathedral, great barn or
royal gardens that scores big for what stands around it. A rival lord can share an island with you,
placing a tile of its own after each of yours, and thirty puzzle islands give a set pouch to score
for up to three stars.

![A kingdom in round 3: the decree's lake outlined, a house previewed with its neighbour links](cover.png)

## How to play

| Control | Action |
| --- | --- |
| Tap or click a tile button | Pick one of the three tiles drawn this turn |
| Hover a cell | See what the picked building would score there, which neighbours pay into it, and whether it joins the castle |
| Tap or click a grass cell | Place the building there; the other two tiles go back and a new three are drawn |
| On a touchscreen, tap a grass cell once, then again | The first tap shows the preview (there is no hover); a second tap on the same cell places the building (clearing a wood works the same way) |
| Tap a house with a house beside it, then that house | Merge the two into a manor (tap anything else to cancel) |
| Pick the lumber camp, then tap a wood beside a camp | Clear the wood to grass, spending the camp tile |
| Tap a market | Open the market trade: give two tiles of one kind for one gift building, once a round |
| Tap a gift | When the round's goal is reached: take one of the two gifts |
| Undo last tile | Take back the last placement, clearing or merge; once per round |
| Island button (next to the round) | Open the islands card: campaign levels, the island of the day, a random island, a rival lord, or type a number (keypad or keyboard digits, Enter to play, Esc to close) |
| Puzzles (on the islands card) | Open the puzzle islands and play one that is open |
| Feats (on the islands card) | Open the kingdom feats and pick a tile skin won by one |
| Sail on | After the game ends: settle the next island of this kingdom's chain (Try again on a puzzle island or against a rival lord) |
| New kingdom | After the game ends: start again on a new random island |

1. **Buildings go on grass.** Lakes and forests stay as they are, but buildings score from them.
2. **The score is the whole board's**, plus the decree bonuses won: a placement also changes what
   the buildings next to it are worth, and the popups show each change.
3. **Neighbour links**: while you hover a cell, a dotted link runs from each neighbour that adds
   points to the ghost tile, with its share at the neighbour's end (a lake +1, a farm beside a house
   +2, a tower that gains from a new house +2, ...), and the total sits over the ghost. The shares
   and the ghost's own base point always add up to the total.
4. **Rounds**: round 1 starts with 4 farms, 4 houses, 2 towers and a road and a goal of 20.
   Reaching the goal adds 3 farms, 3 houses, 2 towers and a road to what is left, and the goal
   rises (20, 45, 75, 110, ...).
5. **Draw three, keep one**: each turn draws three tiles from the pouch, and the panel shows one
   button per kind drawn (with how many of it are in the hand). You place one; the others go back,
   and the next turn draws three again. The pouch line under the buttons says what is left to
   draw. The draw always holds a tile that has room if the pouch has one. Undo gives back the
   hand the tile came from.
6. **Royal decree**: each round has a side goal, shown in the banner above the board with its
   progress beads, such as "3 farms on the shore of Eastmere" or "2 houses by Northwood" or "A tower
   watching 3 houses". The board outlines the named lake or wood (with its name), ticks the
   buildings that already count and marks the open spots. Fulfilling it pays **+8 points and a
   crown** at once; crowns are counted in the banner and kept from kingdom to kingdom. A decree not
   fulfilled by the round's end lapses, and the next round brings a new one. Lakes and woods are
   named from where they lie on the island (Eastmere, Westpool, Northwood, ...). A decree is only
   asked when the board has room for it and the pouch holds the tiles it needs.
7. **Royal gift**: the panel shows the two gifts on offer for reaching the goal ("Gift at 20: +2
   Towers or Windmill"). When the goal is reached, the board pauses on a card until you take one.
   Round 1 always offers +2 Towers or the Windmill; later rounds offer one new building you don't
   have yet (the Windmill, then the Market, the Harbor, the Lumber camp and the Temple) beside +2
   Towers, +3 Houses or +3 Farms. Once all five are won, two of the tile packs and +2 of each new
   building.
8. **New buildings**, each won as a gift: the **market** scores 1 for each different kind of
   building around it; the **harbor** goes on a lake's shore or the coast (a cell on the island's
   edge, or beside the sea on a chain island) and scores each side facing the sea; the **lumber
   camp** only goes beside a forest and makes each house beside it score 1 more; the **temple**
   wants quiet: it scores 1 per cell between it and the nearest tower, up to 4.
9. **Manors**: tap a house that has a house beside it, then tap that house. The second house
   becomes a manor (4 points and more per farm) and the first cell is grass again, free to build
   on. A merge takes no tile, counts for the decree and the goal, and can be undone like a tile.
10. **The castle and its roads**: every island has a castle. Buildings joined to it by an unbroken
    chain of buildings and roads (sharing edges) each pay **+1 when the kingdom is finished**; the
    panel counts them as you build ("Castle joins 5"), a gold bead marks each joined cell, and the
    preview shows "castle +N" when a placement joins more. The **road** is a tile in every pouch
    that scores nothing, but bridges gaps in the chain.
11. **Omens**: from round 3, the strip above the undo button (and the round banner) warns of what
    the next round brings, and the board marks the cell with a coral box. A **flood**: a named
    lake rises over a marked shore cell (grass or a farm) when the next round begins, whatever
    stands there (a wonder built over it is lost whole). A **storm**: the marked tower, which has no house around it, falls when the
    next round begins, unless a house stands by it by then. A round to prepare.
12. **Clear a wood**: pick the lumber camp and tap a wood beside a lumber camp already standing.
    The wood becomes grass and the camp tile is spent: the camp and the houses beside the wood
    lose its points (the preview shows the loss), but there is room to build. It can be undone.
13. **Market trades**: once a round, while a market stands, tap it to open the trade card and
    give two tiles of one kind from the pouch for one gift building you have already won and that
    has somewhere to go (or a wood to clear). A new hand is drawn afterwards, and a trade cannot be
    undone; if nothing has room after it, the kingdom ends.
14. **Seasons**: each round has one, in turn: Spring fair (markets and harbors score double),
   Harvest festival (farms), Timber season (houses and lumber camps) and Winter watch (towers and
   windmills). The strip under the gift row shows it. A doubled building scores its worth again
   as a bonus when you place it, and the preview shows a small "x2"; buildings already standing
   never change when the season does.
15. **Islands** are random: two or three lakes, two or three woods and the castle scattered over
    the grass, so every kingdom is a new puzzle. Every island has a lake with room on its shore for
    the first decree and room around the castle for its chain. The island button opens the islands card, where you can type
    any island number from 1 to 9999 to play it (share the number to share the puzzle), play the
    **island of the day** (the same island for everyone that day, with its own best score), or
    play the **campaign**.
16. **Campaign**: eight islands, each with three star scores shown on the card and at the bottom
    of the panel. Your final score on a level earns one to three stars, and a star opens the next
    level. The best stars per level are saved.
17. **Undo** takes back the last tile placed, wood cleared or merge, once per round. A tile that
    fulfilled a decree or started a new round cannot be taken back.
18. **The end** comes when the pouch is empty or no tile has room left. If two houses could still
    merge, or a lumber camp clear a wood, to make room, the undo button reads "No room: merge houses
    or finish" (or "No room: clear a wood or finish"): make room, or tap it to finish the kingdom.
    While the last tile can still be undone, the button stays Undo, so a slip on the last grass
    cell can be taken back first. The castle then pays its bonus, and the best final score and the
    crowns are saved in the browser.
19. **Trophies**: ten to earn across your kingdoms, listed behind the Trophies button on the start
    and pause screens. A first decree, manor, market trade and all five gift buildings are bronze;
    round 8, 40 buildings joined to the castle and 10 crowns in all are silver; a kingdom of 350
    points, three stars on a campaign level or a puzzle island and a star on every level are gold.
20. **Island chains**: when a kingdom is finished, **Sail on** settles the next island of its
    chain (the same chain for every player who starts from the same island). From the second
    island on, the sea cuts into the island's shape (two corners and a bay), so it has more coast
    and less room, and each has a building found only there, two in its first pouch and one more
    each round: the **lighthouse** (coast only: 1 per side facing the sea, 2 per harbor around
    it) or the **orchard** (1 per farm, forest or windmill around it). The last island's harbors
    ship cargo: one tile per harbor (up to 4) of the gift buildings won there. On a chain island
    each harbor pays **+2 trade** when the kingdom is finished. The island button reads "Chain 2:
    4821", the panel's bottom line counts the chain's score so far, and the longest chain is saved.
21. **Kingdom feats**: seven goals done on any island, each unlocking a **tile skin**, a new paint
    for the grass: a farm with 3 lakes beside it, a tower with 6 houses or manors around it, a
    manor with 3 farms beside it, a temple worth 4 on an island with a tower, a market with 5
    different buildings around it, a lighthouse with 2 harbors around it, and sailing on to the
    third island of a chain. A board at the top of the tray names a feat when it is won; the
    **Feats** button on the islands card lists them and picks the skin, which is kept.
22. **Wonders**: each kingdom draws one wonder from its island's number (the pouch line names it
    until then), and it joins the pouch as **round 3** begins: a 2x2 building placed with the
    hovered cell as its top left, on four grass cells. It is worth 4 and scores big for the twelve
    cells around its block: the **cathedral** 3 per house or manor, the **great barn** 2 per farm
    and 3 per windmill, the **royal gardens** 2 per lake or forest and 3 per temple. It joins the
    castle's chain like any building (and counts once for its bonus).
23. **A rival lord**: **Face a rival lord** on the islands card starts a random island shared with
    one. After each of your tiles, clearings and merges it places one tile of its own, picked from
    four drawn from its own pouch (it gets the same round tiles as you, the gift you leave and the
    season's double points). Its buildings carry a plum frame and bead, and its last tile is marked
    with its name. Every building scores from all its neighbours, the rival's too, but each side only
    counts its own; your decrees, merges, feats, trades, clearings and the castle's chain only count your own buildings,
    and the rival's own chain to the castle pays it at the end. The higher final score wins, and the
    rival lords beaten are saved. On Normal it weighs the points it takes from you at half its own,
    on Easy not at all and on Hard as much as its own.
24. **Puzzle islands**: thirty fixed islands, each with a set pouch (from eight farms and houses to
    seventeen tiles with gift buildings and a wonder) and three star scores. No rounds, gifts,
    decrees, omens or seasons: place the whole pouch, the castle pays its bonus and the final score
    earns up to three stars, shown on the puzzles card. A star opens the next puzzle, and the best
    stars are saved. The goal bar runs to the next star.

![Hovering a cell beside the castle: the house would score 1 from the forest and join the castle's chain](docs/screenshots/playthrough-1-preview.webp)

### Scoring

"Beside" means the four cells sharing an edge; "around" also counts the four diagonals.

| Building | Scores |
| --- | --- |
| Farm | 1, and 1 more per lake beside it |
| House | 2 per farm beside it, and 1 per house, manor, forest or lumber camp beside it |
| Tower | 2 per house or manor around it, but nothing while another tower is beside it |
| Windmill (a gift) | 1 per farm around it; and each farm beside it scores 1 more |
| Market (a gift) | 1 for each different kind of building around it |
| Harbor (a gift) | Only on a lake's shore or the coast: 2 per lake, 1 per side facing the sea and 1 per house or manor beside it |
| Lumber camp (a gift) | Only beside a forest: 2 per forest beside it; and each house beside it scores 1 more. Spend one to clear a wood beside a camp |
| Temple (a gift) | 1 per cell between it and the nearest tower (diagonal steps count as one), up to 4; 4 with no tower |
| Cathedral (a wonder, 2x2) | 4, plus 3 per house or manor among the twelve cells around its block |
| Great barn (a wonder, 2x2) | 4, plus 2 per farm and 3 per windmill around its block |
| Royal gardens (a wonder, 2x2) | 4, plus 2 per lake or forest and 3 per temple around its block |
| Lighthouse (chain islands only) | Only on the coast: 1 per side facing the sea and 2 per harbor around it |
| Orchard (chain islands only) | 1 per farm, forest or windmill around it |
| Road | Nothing; it runs the castle's chain on |
| Manor (two houses merged) | 4, plus 3 per farm and 1 per house, manor or forest beside it |
| Castle (on every island) | Nothing itself; every building joined to it by a chain of buildings and roads pays 1 when the kingdom is finished |

### The three loop changes

![The decree fulfilled: the third farm on Eastmere's shore pays +8 and a crown, and reaches the goal](docs/screenshots/playthrough-2-decree.webp)

![Neighbour links: the farm pays +2 and the forest +1 into the house](docs/screenshots/playthrough-3-links.webp)

![The round's goal reached: choose a royal gift](docs/screenshots/playthrough-4-gift.webp)

![The windmill won: its button joins the panel, and a farm beside it links +2](docs/screenshots/windmill.webp)

![Island 324 with its first decree](docs/screenshots/island-324.webp)

![Island 7409 with its first decree](docs/screenshots/island-7409.webp)

![The kingdom is built](docs/screenshots/game-over.webp)

### The hand, the castle, omens, trades and clearing woods

![A new kingdom: the hand of three drawn from the pouch (two houses and a tower), the castle on the island and the pouch line](docs/screenshots/playthrough-0-start.webp)

![Hovering beside the castle: the house's preview shows "castle +1"](docs/screenshots/castle-preview.webp)

![A road placed: gold beads mark the house, the farm and the road joined to the castle](docs/screenshots/road-chain.webp)

![Round 4: the omen strip warns that Westmere will flood the marked cell when round 5 begins](docs/screenshots/omen-flood.webp)

![Round 5 begins: the flood took the cell, and a new omen marks a farm](docs/screenshots/omen-struck.webp)

![The market trade card: two farms picked to give, a lumber camp to take](docs/screenshots/trade-card.webp)

![Clearing a wood: with the lumber camp picked, the wood beside the camp shows what clearing it costs](docs/screenshots/clear-wood.webp)

### Island chains, coast buildings and feats

![Island 2 of a chain: the sea cuts into its corners and a bay, a harbor stands on the coast and a lighthouse beside it would score 4](docs/screenshots/chain-island.webp)

![A temple far from the towers scores the full 4](docs/screenshots/temple-preview.webp)

![A chain island finished: its harbor's trade and the chain's total, with Sail on to the next island](docs/screenshots/chain-over.webp)

![The feats card: three feats won, and the Spring skin picked from the tile skins](docs/screenshots/feats-card.webp)

### New buildings, manors, seasons and islands

![All four gift buildings won: the panel switches to two columns, with the picked building's rule under them](docs/screenshots/new-buildings.webp)

![Spring fair: a harbor on the shore scores double, shown by the x2 on its preview](docs/screenshots/season-harbor.webp)

![Timber season: a lumber camp beside two forests, doubled](docs/screenshots/season-lumber.webp)

![Merging two houses: the manor's ghost and what it adds](docs/screenshots/merge-preview.webp)

![The manor stands, and the cell beside it is grass again](docs/screenshots/manor.webp)

![The islands card: campaign levels with stars, the island of the day and a keypad for an island number](docs/screenshots/islands-card.webp)

![No tile has room left, but two houses could still merge](docs/screenshots/no-room.webp)

![A campaign level finished with one star](docs/screenshots/campaign-over.webp)

### Wonders, the rival lord and puzzle islands

![A wonder previewed: the royal gardens' 2x2 block, with each lake and wood around it linking +2](docs/screenshots/wonder-preview.webp)

![A rival lord shares the island: its buildings framed in plum, its last tile named, and both scores at the bottom of the panel](docs/screenshots/rival-lord.webp)

![The puzzles card: thirty puzzle islands with their best stars, the next one's star scores under them](docs/screenshots/puzzles-card.webp)

![A trophy earned: its toast at the top of the page](docs/screenshots/trophy-toast.webp)

![The Trophies list on the pause screen](docs/screenshots/trophies.webp)

The difficulty, set on the hub page's Settings, changes the round goals, 20% lower on Easy and 20% higher on Hard, and moves the campaign's star scores with what that does to a final score: 1% higher on Easy and 6% lower on Hard. The puzzle islands' star scores are 10% lower on Easy and 5% higher on Hard (but never above the three-star score, so three stars stay reachable), and the rival lord ignores the points it could take from you on Easy and weighs them as much as its own on Hard (half on Normal).

## Running locally

`npm run dev` at the repo root, then open `/games/tiny-kingdom/` (or pick Tiny Kingdom on the hub
page).

## Playthrough test

`e2e/playthrough.spec.ts` plays the first round in headless Chromium: it seeds `Math.random` so
the game always picks the same island (1990), checks the new kingdom, its map (with the castle), its
first hand of three, its decree (3 farms on the shore of Eastmere) and its gifts, picks the house
and hovers a cell beside the castle to check the preview, its forest link and that it joins the
castle, checks a tap on the castle or a lake places nothing, then places seven tiles by tapping (a
house, four farms, a house and a road), checking the hand drawn before each one, the tile buttons
it gives and the score each adds against the rules. After the farm by the castle it tests undo: the
undo takes that farm back with the hand it came from, a second undo in the round does nothing, and
the farm goes back down. Hovering the second house before placing it checks its two links, and the
road's preview shows +0. The last farm fulfils the decree (+8, a crown, saved) and reaches the goal
at once: round 2 begins with a new hand, nothing can be placed until the gift is taken, and taking
the Windmill adds its tiles. Like the other games' tests it owns the game
clock and plays at 4x speed (`PLAYTHROUGH_SPEED`). The **Playthrough Tiny Kingdom** workflow
(`.github/workflows/playthrough.yml`) runs it on every PR that changes this folder or the
workflow, and uploads the video and screenshots as the `playthrough-tiny-kingdom` artifact.

```sh
npx playwright test --project tiny-kingdom
```

![Round 2 with the windmill and a new decree](docs/screenshots/playthrough-5-round-2.webp)

## Code layout

All paths are inside `games/tiny-kingdom/`.

- `src/game/`: the rules in plain TypeScript with no Phaser dependency. `tiles.ts` has the
  buildings and the random island generator (with the castle), `state.ts` the scoring, previews,
  the hand, rounds, placing, clearing woods, trades, merging and gifts taken, `decree.ts` the royal
  decrees and the lake and wood names, `omens.ts` the omens, `castle.ts` the castle's chain,
  `gifts.ts` the gifts, `seasons.ts` the seasons, `islands.ts` the campaign, the puzzle islands,
  the island of the day and typed island numbers, `feats.ts` the kingdom feats and tile skins, and
  `save.ts` the best score, the crowns, the daily best, the stars, the puzzle stars, the rival lords
  beaten, the best chain, the feats and the skin. The rival lord's turn and the wonders' scoring are
  in `state.ts`.
- `src/scenes/`: `BootScene` paints the textures, `GameScene` draws the board, the decree banner,
  the side panel, the trade card, the islands card and the puzzles card and wires taps to the rules, `layout.ts`
  says where things are drawn.
- `src/art/`: the wooden toy set, painted on canvases in code at startup: `wood.ts` the toolkit and
  painters, `textures.ts` every texture.
- `src/ui/`: the button.
- `src/trophies/`: the trophy list and texts (`index.ts`, `i18n/`), and `check.ts`, which awards
  them from the game state.

Changing a building's rule is its case in `cellParts` in `src/game/state.ts` and its line in
`INFO` in `src/game/tiles.ts`.
