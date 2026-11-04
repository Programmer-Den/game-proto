import { playMusic, playSting, stopMusic, ui } from '../../../../shared/audio';
import { BATTLE_SONG, HARBOR_SONG, sfx, STINGS, type SoundName } from '../audio';
import { HULLS } from '../game/hulls';
import { loadedShot, offset, radiusOf, stats, type GameState, type Side } from '../game/state';
import { VIEW } from './layout';

const SIDES: Side[] = ['port', 'starboard'];
/** How far past the screen's edge something still counts as in sight, in game pixels. */
const MARGIN = 40;
/** The gap between the booms of one broadside's guns, in ms. */
const GUN_STAGGER = 70;
/** At most this many booms per broadside, however many guns. */
const MAX_BOOMS = 3;
/** A shell whistles once this close to coming down, in ms. */
const WHISTLE_MS = 700;

/**
 * Turns what changed in the state over one `tick` into sound and music, so the sim stays free of
 * audio. `GameScene` calls `before` just ahead of `tick` and `after` right after it. Effects are
 * new when their id is above the last one seen (ids only ever grow), and only those on screen
 * sound; each kind plays at most once a frame, so a broadside of hits is one crack.
 */
export class SoundCues {
  private phase: GameState['phase'];
  private reload: Record<Side, number> = { port: 0, starboard: 0 };
  private charge: Record<Side, number | null> = { port: null, starboard: null };
  private aground = 0;
  private helm = 0;
  private convoy: string | null = null;
  private lastEffect: number;
  private enemies = new Set<number>();
  private whistled = new Set<number>();
  private music = '';
  private clock = 0;
  /** Booms still to come from a broadside, by when (on `clock`). */
  private later: { at: number; name: SoundName; volume: number }[] = [];

  constructor(s: GameState) {
    this.phase = s.phase;
    this.lastEffect = s.nextId;
    for (const e of s.enemies) this.enemies.add(e.id);
    this.updateMusic(s);
  }

  /** Remembers the state ahead of a tick. */
  before(s: GameState) {
    this.phase = s.phase;
    for (const side of SIDES) {
      this.reload[side] = s.player.reload[side];
      this.charge[side] = s.charge[side];
    }
    this.aground = s.player.agroundMs;
    this.helm = s.helm;
    this.convoy = s.convoy?.state ?? null;
  }

  /** Plays what the tick just did. */
  after(s: GameState, dt: number) {
    this.clock += dt;
    this.playLater();
    if (s.phase !== this.phase) this.phaseChanged(s);
    this.updateMusic(s);
    const sailing = s.phase === 'break' || s.phase === 'fighting';
    if (sailing) {
      this.playerGuns(s);
      if (s.helm !== 0 && this.helm === 0) sfx('creak');
      if (s.player.agroundMs > this.aground) sfx('aground');
    }
    this.effects(s);
    this.shells(s);
    this.spawned(s);
    const convoy = s.convoy?.state ?? null;
    if (convoy !== this.convoy && this.convoy === 'sailing') sfx(convoy === 'arrived' ? 'bell' : 'escape');
  }

  private phaseChanged(s: GameState) {
    if (s.phase === 'fighting' && this.phase === 'break') playSting(STINGS, 'wave');
    else if (s.phase === 'harbor' && this.phase !== 'won') {
      playSting(STINGS, 'harbor');
      if (s.bountyPaid) sfx('bounty');
    } else if (s.phase === 'over') {
      stopMusic();
      this.music = '';
      playSting(STINGS, 'lose');
    } else if (s.phase === 'won') playSting(STINGS, 'win');
  }

  /** Calm between waves and in harbor, the jig while fighting, its heavy part once a flagship sails. */
  private updateMusic(s: GameState) {
    let want = '';
    if (s.phase === 'fighting') want = s.enemies.some((e) => e.kind === 'flagship' || e.kind === 'admiral' || e.kind === 'tempest') ? 'boss' : 'battle';
    else if (s.phase !== 'over') want = 'calm';
    if (want === this.music) return;
    this.music = want;
    if (want === 'calm') playMusic(HARBOR_SONG, 'calm');
    else if (want) playMusic(BATTLE_SONG, want);
  }

  /** The player's broadsides: the charge rising, then staggered booms once a side lets fly. */
  private playerGuns(s: GameState) {
    for (const side of SIDES) {
      const charge = s.charge[side];
      if (charge !== null && charge < 1 && s.aim[side]) sfx('charge', { pitch: 1 + charge * 0.9 });
      if (charge === 1 && (this.charge[side] ?? 0) < 1) sfx('charged');
      // A side's reload only ever goes up when it fires.
      if (s.player.reload[side] <= this.reload[side]) continue;
      // The Bomb Ketch's mortar side lobs a shell, whose smoke plays the mortar's thump in `effects`.
      if (HULLS[s.hull].mortarSide === side) continue;
      const power = 0.7 + 0.3 * (this.charge[side] ?? 0);
      const booms = Math.min(MAX_BOOMS, stats(s).guns);
      for (let i = 0; i < booms; i++) this.later.push({ at: this.clock + i * GUN_STAGGER, name: 'cannon', volume: power });
      this.later.push({ at: this.clock, name: 'thump', volume: power });
      if (loadedShot(s, side) === 'grape') sfx('grape');
    }
  }

  private playLater() {
    const due = this.later.filter((l) => l.at <= this.clock);
    if (!due.length) return;
    this.later = this.later.filter((l) => l.at > this.clock);
    for (const l of due) sfx(l.name, { volume: l.volume });
  }

  private seen(s: GameState, p: { x: number; y: number }) {
    const { dx, dy } = offset(s.player, p);
    return Math.abs(dx) < VIEW.w / 2 + MARGIN && Math.abs(dy) < VIEW.h / 2 + MARGIN;
  }

  /** The effects the tick added, one sound per kind. */
  private effects(s: GameState) {
    const heard = new Set<SoundName | 'coin'>();
    const near = radiusOf(s.player) * 1.25;
    let newest = this.lastEffect;
    for (const e of s.effects) {
      if (e.id < this.lastEffect) continue;
      newest = Math.max(newest, e.id + 1);
      if (!this.seen(s, e)) continue;
      const { dx, dy } = offset(s.player, e);
      const mine = Math.hypot(dx, dy) < near;
      switch (e.kind) {
        case 'smoke':
          // A lob's smoke lasts 800ms, a gun's 600ms. The player's own guns are played in `playerGuns`.
          if (e.total === 800) heard.add('mortar');
          else if (!mine) heard.add('distant');
          break;
        case 'hit':
          heard.add(mine ? 'hurt' : 'hit');
          break;
        case 'splash':
          heard.add('splash');
          break;
        case 'blast':
          heard.add('blast');
          break;
        case 'sink':
          heard.add('sink');
          heard.add('gurgle');
          break;
        case 'coins':
          heard.add('coin');
          break;
        case 'prize':
          heard.add('prize');
          break;
        case 'escape':
          heard.add('escape');
          break;
        case 'squall':
          heard.add('squall');
          break;
      }
    }
    this.lastEffect = newest;
    // Running aground leaves a hit of its own; the grinding thud stands for it.
    if (s.player.agroundMs > this.aground) heard.delete('hurt');
    for (const name of heard) {
      // Loot hauled in: the shared coin jingle, so gold sounds the same in every game.
      if (name === 'coin') ui('coin');
      else sfx(name);
    }
  }

  /** A shell whistles as it comes down where the player can see it. */
  private shells(s: GameState) {
    for (const shell of s.shells) {
      if (shell.ms > WHISTLE_MS || this.whistled.has(shell.id) || !this.seen(s, shell)) continue;
      this.whistled.add(shell.id);
      sfx('whistle');
    }
    if (!s.shells.length) this.whistled.clear();
  }

  /** The bosun's pipe for each sail that comes over the horizon. */
  private spawned(s: GameState) {
    let fresh = false;
    for (const e of s.enemies) {
      if (this.enemies.has(e.id)) continue;
      this.enemies.add(e.id);
      fresh = true;
    }
    if (fresh) sfx('pipe');
  }
}
