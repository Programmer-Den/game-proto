import { playMusic, playSting, type Song } from '../../../../shared/audio';
import { BOSS_MARCH, MARCH } from '../audio/music';
import { sfx } from '../audio/sfx';
import { ENEMIES } from '../game/enemies';
import { omenEffects } from '../game/omens';
import { SPAWN_X, type GameState } from '../game/state';
import { isBossWave } from '../game/waves';

/** How often the chop sounds while foes hack at the barricade or the stake line, in game ms. */
const CHOP_MS = 420;

/** What `BattleSounds` needs to remember of the state from before a tick. */
interface Before {
  state: GameState;
  nextId: number;
  phase: GameState['phase'];
  wave: number;
  level: number;
  barricade: number;
  stakes: number;
  rainReady: boolean;
  caltropsReady: boolean;
  /** The arrows in the air, by id, with where they were. */
  arrows: Map<number, number>;
}

/**
 * Plays the battle's sounds and picks its music by comparing the state before and after each
 * `tick`, so the rules in `src/game/` stay free of sound: new effects and missiles (their ids are
 * at least the `nextId` from before), arrows gone, the phase, the level and the barricade. A new
 * state (a restart, a retirement, a save loaded) only sets the baseline, so nothing plays for it.
 */
export class BattleSounds {
  private before: Before | null = null;
  private chopMs = 0;
  private music: { song: Song; part: string } | null = null;

  /** Remembers the state before the tick. */
  mark(s: GameState) {
    const arrows = new Map<number, number>();
    for (const m of s.missiles) if (m.kind === 'arrow') arrows.set(m.id, m.x);
    this.before = {
      state: s,
      nextId: s.nextId,
      phase: s.phase,
      wave: s.wave,
      level: s.level,
      barricade: s.barricade.hp,
      stakes: s.forts.stakeHp,
      rainReady: s.rain.charge >= s.rain.need,
      caltropsReady: s.caltrops.charge >= s.caltrops.need,
      arrows,
    };
  }

  /** Plays what the tick of `dt` game ms changed, and switches the music to fit. */
  play(s: GameState, dt: number) {
    const b = this.before;
    this.music_(s);
    if (!b || b.state !== s) return;
    const fresh = (id: number) => id >= b.nextId;
    const sight = omenEffects(s.omen).sight;

    // What was launched: one sound per volley.
    const launched = new Set(s.missiles.filter((m) => fresh(m.id)).map((m) => m.kind));
    if (launched.has('arrow')) sfx('bow');
    if (launched.has('fireball') || launched.has('rock')) sfx('whoosh');
    // The hired mage's bolt and the mage hero's cast share the arcane sound.
    if (launched.has('magic') || launched.has('spell')) sfx('magic');
    // Arrows that are gone hit something, unless the wave ended or the run did and cleared them.
    if (s.phase === b.phase && s.wave === b.wave) {
      const still = new Set(s.missiles.map((m) => m.id));
      for (const [id, x] of b.arrows) {
        if (!still.has(id) && x > 0 && x < Math.min(SPAWN_X, sight)) {
          sfx('hit');
          break;
        }
      }
    }

    // The effects added this tick, at most one sound of each kind.
    const kinds = new Set<string>();
    let biggest = 0;
    let streak = 0;
    let boss = false;
    for (const e of s.effects) {
      if (!fresh(e.id) || e.x >= sight) continue;
      kinds.add(e.kind);
      if (e.kind === 'death') {
        biggest = Math.max(biggest, e.radius ?? 14);
        if ((e.radius ?? 0) >= ENEMIES.troll.radius) boss = true;
      }
      if (e.kind === 'xp') streak = Math.max(streak, e.streak ?? 1);
    }
    if (boss) sfx('bossDown');
    else if (kinds.has('death')) sfx('pop', { pitch: Math.min(1.1, 15 / biggest) });
    if (kinds.has('split')) sfx('split');
    if (kinds.has('xp')) sfx('xp', { pitch: 1 + Math.min(streak - 1, 10) * 0.06 });
    if (kinds.has('crit')) sfx('crit');
    if (kinds.has('block')) sfx('clank');
    if (kinds.has('fireblast')) sfx('boom');
    else if (kinds.has('blast')) sfx('blast');
    if (kinds.has('bolt')) sfx('zap');
    if (kinds.has('stab')) sfx('stab');
    if (kinds.has('arcane')) sfx('arcane');
    if (kinds.has('heal')) sfx('heal');
    if (kinds.has('rockHit')) sfx('thud');
    if (kinds.has('call')) sfx('horn', { pitch: 1.33 });
    if (kinds.has('roar') || kinds.has('howl')) sfx('roar');
    if (kinds.has('rain')) sfx('rainLand');
    if (kinds.has('autoPick')) sfx('pick');

    // Arrow Rain or the caltrops just charged.
    const rainReady = s.rain.charge >= s.rain.need;
    const caltropsReady = s.caltrops.charge >= s.caltrops.need;
    if ((rainReady && !b.rainReady) || (caltropsReady && !b.caltropsReady)) sfx('ready');

    // Foes hacking at the barricade or the stake line, and either breaking.
    if (s.barricade.hp < b.barricade || s.forts.stakeHp < b.stakes) {
      this.chopMs -= dt;
      if (this.chopMs <= 0) {
        sfx('chop');
        this.chopMs = CHOP_MS;
      }
    } else this.chopMs = 0;
    if ((b.barricade > 0 && s.barricade.hp <= 0) || (b.stakes > 0 && s.forts.stakeHp <= 0)) sfx('crash');

    if (s.level > b.level) sfx('levelUp');
    if (b.phase === 'break' && s.phase === 'fighting') sfx('horn');
    if (b.phase === 'fighting' && s.phase === 'break') {
      sfx('cleared');
      if (s.relicFound) sfx('relic');
    }
    if (b.phase !== 'over' && s.phase === 'over') playSting(MARCH, 'lose');
    if (b.phase !== 'won' && s.phase === 'won') playSting(MARCH, 'win');
  }

  /** The march fits the moment: calm in a break, the battle (or the boss) in a wave, the pad while waiting. */
  private music_(s: GameState) {
    const [song, part]: [Song, string] =
      s.phase === 'over' || s.phase === 'won' || s.choices
        ? [MARCH, 'pad']
        : s.phase === 'fighting'
          ? isBossWave(s.wave)
            ? [BOSS_MARCH, 'boss']
            : [MARCH, 'battle']
          : [MARCH, 'calm'];
    if (this.music?.song === song && this.music.part === part) return;
    this.music = { song, part };
    playMusic(song, part);
  }
}
