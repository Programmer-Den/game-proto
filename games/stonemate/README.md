# Stonemate

Chess with living statues. White marble and black obsidian pieces with rune-lit eyes walk the
board, and every capture plays a scene of its own: the attacker strikes the way its kind fights,
and the victim breaks the way its kind breaks. Play the Stone AI as White or Black, or a friend on
one screen, and watch any capture in the gallery.

![The menu](docs/screenshots/menu.webp)

## How to play

Tap one of your statues to pick it up: the squares it can reach are marked, with a ring round a
statue it can take. Tap a marked square to move. The usual rules of chess hold, castling, en passant
and promotion included (a pawn on the far row becomes the piece you pick), and a game ends in
checkmate or a draw (stalemate, too few pieces to mate, fifty moves without a capture or pawn move,
or the same position three times).

![A game, with a bishop picked up](docs/screenshots/board.webp)

- **Undo** (or U) takes back your last move, and the Stone AI's reply.
- **Captures: full / quick** (or Q) switches between the full scenes and quick ones that skip the
  strike and play the fall at double speed.
- **Menu** leaves the game; it is saved after every move, and **Continue game** on the menu picks it
  up again.
- The hub's difficulty sets the Stone AI: Easy looks one move ahead and often picks a weaker move,
  Normal looks two ahead, Hard three and always plays its best.

### Captures

A king is never taken, so there are 6 attackers and 5 victims: 30 pairs. Each kind of piece has
one strike and each kind one fall, and every capture plays the attacker's strike and then the
victim's fall, so all 30 pairs differ.

| Attacker | Strike |
| --- | --- |
| Pawn | Sword chop: shuffles up, rears back and chops |
| Knight | Hoof stomp: a high leap, a rear and a slam with a shockwave |
| Bishop | Staff blast: its eyes flare and a rune bolt flies |
| Rook | Body slam: backs up, then charges in a straight line |
| Queen | Rune beam: rises and burns a beam through |
| King | Sceptre smite: an orb of light drops onto the victim |

| Victim | Fall |
| --- | --- |
| Pawn | splits in two |
| Knight | its head topples off and rolls away; the body crumbles |
| Bishop | cracks open along its veins and splits |
| Rook | falls to rubble |
| Queen | bursts to shards |

Eight pairs play a hand-made scene instead (★ in the gallery):

| Pair | Scene |
| --- | --- |
| Pawn takes Pawn | Scuffle: two shoves, then the chop |
| Pawn takes Queen | Upset!: the queen looms, one tiny tap, a silence, and she bursts |
| Knight takes Knight | Joust: both charge and meet in the middle |
| Knight takes Rook | Tower vault: the knight leaps over the tower and kicks it down from behind |
| Bishop takes Bishop | Rune duel: two bolts wrestle in the middle until one breaks through |
| Rook takes Rook | Siege: three rams, and the tower gives on the third |
| Queen takes Queen | Royal duel: two beams meet and one pushes through |
| King takes Queen | Royal decree: the queen bows and turns to dust |

Checkmate ends with the beaten king cracking and falling to rubble. With the hub's Reduce motion
on, the scenes play without screen shake or flashes.

![Knight takes Knight in the capture gallery](docs/screenshots/gallery.webp)

### Trophies

First blow, Carved anew (promote a pawn), Joust, Stone cold (beat the Stone AI), Upset! (a pawn
takes a queen), Swift mason (mate within 25 moves), Every signature scene, Grandmaster of stone
(win on Hard) and one hidden.

## Code layout

| File | What it holds |
| --- | --- |
| `src/main.ts` | Creates the Phaser game and hands it to `setupGame` and `setupScaling` |
| `src/game/chess.ts` | The rules: a position with make and unmake, legal moves, check, mate and draws |
| `src/game/ai.ts` | The Stone AI: alpha-beta search with a capture search at the leaves |
| `src/game/rules.ts` | The AI's level by difficulty, the signature pairs, the quick-mate limit |
| `src/game/save.ts` | The saved game and the stats |
| `src/scenes/GameScene.ts` | The menu, the board and panel, input, moves and the gallery |
| `src/scenes/captures.ts` | Every strike, fall and signature scene |
| `src/scenes/art.ts` | The statues painted in code, and the fragments they break into |
| `src/audio.ts` | Music and sound effects |
| `src/howToPlay.ts`, `src/i18n/`, `src/trophies/` | How to play, texts and trophies |
| `e2e/playthrough.spec.ts` | Plays the first round to White's first capture |
