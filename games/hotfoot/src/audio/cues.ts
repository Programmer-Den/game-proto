import { playMusic, playSting, ui } from '../../../../shared/audio';
import { MISSILES, bossStands } from '../game/boss';
import { flameOf, gustOf, stats, streakMax, streakMult, STREAK, type GameState } from '../game/state';
import { RUNNER_X, VIEW } from '../scenes/layout';
import { SONG, sfx, type MusicPart, type SoundName } from './sound';

/** Steps of the D major scale, in semitones: a row of coins climbs it with the streak. */
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];

/** The loop that fits what the run is doing. */
function partOf(s: GameState): MusicPart {
  if (s.phase !== 'running') return 'camp';
  if (s.boss && bossStands(s)) return 'boss';
  if (s.rockfall) return 'rockfall';
  if (s.terrain === 'ice') return 'ice';
  if (s.terrain === 'marsh') return 'fen';
  if (s.terrain === 'wind') return 'wind';
  if (s.terrain === 'sky') return 'sky';
  return 'road';
}

/**
 * Plays the run's sounds and music from what changed in its state since the last frame, so the
 * sim (`src/game/`) stays free of audio: new effects (coins, hits, stomps, words), the knight's
 * jumps and slides, a boss's throws and stomps, fire vents on screen, the phase and the stage.
 * At most one sound of each kind plays per frame, so a row of coins or a volley stays one sound.
 */
export class SoundCues {
  private nextId = 0;
  private phase: GameState['phase'] = 'running';
  private stage = 0;
  private jumps = 0;
  private sliding = false;
  private dropping = false;
  private mult = 1;
  private bossHp = 0;
  private rockX: number | null = null;
  private flames = new Map<number, string>();
  private gust = 'calm';
  private falling = new Set<number>();
  private part: MusicPart | null = null;

  /** Forgets the last run: call it once a new run starts, before its first frame. */
  reset(s: GameState) {
    this.nextId = s.nextId;
    this.phase = s.phase;
    this.stage = s.stage;
    this.jumps = s.runner.jumps;
    this.sliding = s.runner.slideMs > 0;
    this.dropping = s.runner.slideQueued;
    this.mult = 1;
    this.bossHp = s.boss?.hp ?? 0;
    this.rockX = s.rockfall?.x ?? null;
    this.flames.clear();
    this.gust = gustOf(s);
    this.falling.clear();
    this.music(s);
  }

  /** Called once per frame, after the sim's tick. */
  update(s: GameState) {
    const played = new Set<SoundName>();
    const play = (name: SoundName, pitch = 1) => {
      if (played.has(name)) return;
      played.add(name);
      sfx(name, { pitch });
    };
    const r = s.runner;

    // New effects since the last frame.
    const fresh = s.effects.filter((e) => e.id >= this.nextId);
    const hurt = fresh.some((e) => e.kind === 'hit' || e.kind === 'block' || e.kind === 'fall');

    // The knight's own moves (a pit throws the knight up too, which is no jump).
    if (r.jumps < this.jumps && !hurt) play('jump', this.jumps < stats(s).jumps ? 1.35 : 1);
    const sliding = r.slideMs > 0;
    if (sliding && !this.sliding) play('slide');
    if (r.slideQueued && !this.dropping) play('drop');

    // The boss: stomped, beaten.
    const hp = s.boss?.hp ?? 0;
    const bossStomped = !!s.boss && hp < this.bossHp;
    if (bossStomped) play('bossHit');

    // The rockfall catching the knight: it drops back behind them.
    const rockX = s.rockfall?.x ?? null;
    const rockCaught = rockX !== null && this.rockX !== null && rockX < this.rockX - 100;
    if (rockCaught) play('rock');

    // The new effects, by kind.
    const skid = fresh.some((e) => e.kind === 'skid');
    for (const e of fresh) {
      if (e.kind === 'coin') {
        const into = Math.max(0, s.streak - 1) % STREAK.step;
        play('coin', 2 ** (SCALE[into] / 12));
      } else if (e.kind === 'hit') play('hit');
      else if (e.kind === 'block') play('block');
      else if (e.kind === 'stomp' && !bossStomped && !rockCaught) play('stomp');
      else if ((e.kind === 'dust' && !skid) || e.kind === 'fall') play('land');
      else if (e.kind === 'skid') play('skid');
      else if (e.kind === 'heal') play('heal');
      // A shrine that can't give a heart refuses, with the buzz every refused action gets.
      else if (e.kind === 'refuse') ui('refuse');
      else if (e.kind === 'pop') {
        if (e.text === 'dareMetPop') play('dare');
        else if (e.text === 'gateBeaten') play('bossDown');
        else if (e.text === 'dragonBeaten') playSting(SONG, 'crown');
        else if (e.text && e.text !== 'coinPop') play('pair');
      }
    }

    // The streak's multiplier going up.
    const mult = streakMult(s.streak, streakMax(s.road));
    if (mult > this.mult) play('streak');

    // A boss's throws, and fire vents on screen flaring up.
    const flames = new Map<number, string>();
    for (const t of s.traps) {
      if (t.id >= this.nextId && MISSILES.includes(t.kind)) play(t.kind === 'barrel' || t.kind === 'fire' ? 'roll' : 'throw');
      if (t.kind !== 'flames') continue;
      const burn = flameOf(s, t);
      const x = RUNNER_X + t.x - s.distance;
      const before = this.flames.get(t.id);
      if (before && burn !== before && x > -t.w && x < VIEW.w && s.phase === 'running') {
        if (burn === 'warn') play('crackle');
        else if (burn === 'lit') play('flare');
      }
      flames.set(t.id, burn);
    }
    this.flames = flames;

    // The Sky Road: a gust starting to blow, and a cloud giving way.
    const gust = gustOf(s);
    if (gust === 'blow' && this.gust !== 'blow' && s.phase === 'running') play('gust');
    this.gust = gust;
    const falling = new Set(s.ledges.filter((l) => l.cloud && l.sinkMs === 0).map((l) => l.id));
    for (const id of falling) if (!this.falling.has(id)) play('sink');
    this.falling = falling;

    // The run's phase and stage.
    if (s.phase !== this.phase) {
      if (s.phase === 'checkpoint') play('checkpoint');
      else if (s.phase === 'over') playSting(SONG, 'lose');
    }
    if (s.stage > this.stage && s.phase === 'running') play('horn');

    this.nextId = s.nextId;
    this.phase = s.phase;
    this.stage = s.stage;
    this.jumps = r.jumps;
    this.sliding = sliding;
    this.dropping = r.slideQueued;
    this.mult = mult;
    this.bossHp = hp;
    this.rockX = rockX;
    this.music(s);
  }

  private music(s: GameState) {
    const part = partOf(s);
    if (part === this.part) return;
    this.part = part;
    playMusic(SONG, part);
  }
}
