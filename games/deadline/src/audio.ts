import { sounds, type SoundDef, type Song } from '../../../shared/audio';

/**
 * Deadline's sound: a sound table of short synthesized effects and two songs in E Phrygian (E minor
 * with an F natural), a driving one for the waves at 140 BPM and a heavier one for the boss waves at
 * 150 BPM. `GameScene` plays them; see the Sound section of `AGENTS.md` for where.
 */
export const SOUNDS = {
  /** A volley, once however many rifles fire. */
  shot: { wave: 'noise', freq: 3200, to: 700, length: 0.07, volume: 0.2, gap: 60, vary: 0.06 },
  /** A bullet on a zombie (also burns and blasts): a quiet tick, rate limited as it fires per pellet. */
  hit: { wave: 'square', freq: 1500, to: 1000, length: 0.025, volume: 0.1, gap: 50, vary: 0.08 },
  /** A bullet on a riot shield. */
  block: { wave: 'square', freq: 2300, to: 2150, length: 0.08, volume: 0.16, gap: 90, vary: 0.03 },
  /** A riot shield breaks. */
  shieldDown: { wave: 'square', freq: 1800, to: 400, length: 0.2, volume: 0.24, gap: 120 },
  /** A bullet jumps to the next zombie. */
  ricochet: { wave: 'pulse12', freq: 2000, to: 3600, length: 0.08, volume: 0.14, gap: 100, vary: 0.05 },
  /** A zombie dies: a wet burst, pitched by its size. */
  kill: { wave: 'noise', freq: 1300, to: 180, length: 0.15, volume: 0.3, gap: 45, vary: 0.1 },
  /** A boss falls. */
  bossKill: { wave: 'noise', freq: 700, to: 40, length: 0.9, volume: 0.45, gap: 300 },
  /** A frenzy starts. */
  frenzy: { wave: 'square', freq: 220, to: 440, arp: [0, 7, 12, 19], arpStep: 0.07, length: 0.42, volume: 0.28, gap: 500 },
  /** A fuel drum goes up. */
  boom: { wave: 'noise', freq: 420, to: 35, length: 0.75, volume: 0.48, gap: 120 },
  /** A grenadier's grenade bursts. */
  grenade: { wave: 'noise', freq: 800, to: 90, length: 0.3, volume: 0.34, gap: 90, vary: 0.06 },
  /** A flame burst. */
  flame: { wave: 'noise', freq: 2600, to: 500, attack: 0.08, length: 0.55, volume: 0.3, gap: 300 },
  /** A crate shot open. */
  crate: { wave: 'square', freq: 523, arp: [0, 4, 7], arpStep: 0.05, length: 0.18, volume: 0.28, gap: 80 },
  /** A third crate of a kind evolves into a perk. */
  perk: { wave: 'square', freq: 523, arp: [0, 4, 7, 12, 16], arpStep: 0.07, length: 0.42, volume: 0.3, gap: 300 },
  /** A sandbag wall dropped in a lane. */
  wall: { wave: 'triangle', freq: 130, to: 45, length: 0.22, volume: 0.55, gap: 120 },
  /** A boss smashes a wall. */
  wallSmash: { wave: 'noise', freq: 1000, to: 140, length: 0.32, volume: 0.38, gap: 150 },
  /** A glob of acid leaves a spitter or a boss. */
  spit: { wave: 'triangle', freq: 220, to: 480, arp: [0, 3, 0, 5], arpStep: 0.035, length: 0.18, volume: 0.32, gap: 150, vary: 0.08 },
  /** The glob lands and the puddle sizzles. */
  sizzle: { wave: 'noise', freq: 6000, to: 2600, attack: 0.02, length: 0.4, volume: 0.13, gap: 200 },
  /** A boss winds up a move: a two-tone siren. */
  siren: { wave: 'square', freq: 440, arp: [0, 6, 0, 6], arpStep: 0.11, length: 0.46, volume: 0.22, gap: 300 },
  /** A survivor takes a stray round. */
  yelp: { wave: 'pulse25', freq: 950, to: 600, length: 0.1, volume: 0.24, gap: 150 },
  /** A survivor is lost. */
  survivorLost: { wave: 'triangle', freq: 440, to: 110, length: 0.5, volume: 0.36, gap: 300 },
  /** A survivor reaches the sandbags. */
  rescue: { wave: 'pulse25', freq: 784, arp: [0, 4, 7, 12], arpStep: 0.06, length: 0.3, volume: 0.28, gap: 200 },
  /** A medkit throws the horde back. */
  medkit: { wave: 'triangle', freq: 523, arp: [0, 4, 7, 12], arpStep: 0.08, length: 0.42, volume: 0.4, gap: 300 },
  /** A wave starts: a drum hit. */
  waveStart: { wave: 'triangle', freq: 120, to: 50, length: 0.3, volume: 0.55, gap: 300 },
  /** A wave cleared. */
  cleared: { wave: 'square', freq: 659, arp: [0, 5, 7, 12], arpStep: 0.07, length: 0.36, volume: 0.28, gap: 300 },
  /** The supply drop opens. */
  supply: { wave: 'noise', freq: 1800, to: 4200, attack: 0.03, length: 0.26, volume: 0.18, gap: 300 },
  /** A supply card or a role picked. */
  confirm: { wave: 'square', freq: 660, arp: [0, 7], arpStep: 0.06, length: 0.14, volume: 0.28, gap: 120 },
  /** The Sergeant calls an airstrike: a falling whistle before the blasts. */
  airstrike: { wave: 'triangle', freq: 1800, to: 300, length: 0.8, volume: 0.3, gap: 500 },
  /** The Scout's flare goes up and pops. */
  flare: { wave: 'noise', freq: 2400, to: 7000, attack: 0.05, length: 0.6, volume: 0.2, gap: 500 },
  /** The escort bus gets through: two blasts of its horn. */
  busThrough: { wave: 'square', freq: 392, arp: [0, 4, 0, 4], arpStep: 0.1, length: 0.42, volume: 0.26, gap: 500 },
  /** A zombie bites into the bus: a dull knock, now and then while it holds on. */
  busHit: { wave: 'square', freq: 180, to: 130, length: 0.08, volume: 0.16, gap: 450 },
  /** A codex page fills up. */
  codex: { wave: 'pulse25', freq: 880, arp: [0, 7, 12], arpStep: 0.06, length: 0.3, volume: 0.24, gap: 300 },
} satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;
export const sfx = sounds<SoundName>(SOUNDS);

const bars = (...lines: string[]) => lines.join(' | ');

/** The waves' song: calm in the breaks and on the game over screen, battle in a wave. */
export const SONG: Song = {
  bpm: 140,
  waves: { lead: 'square', harmony: 'pulse25' },
  mix: { lead: 0.13, harmony: 0.05 },
  parts: {
    // A break: the drums drop out and a pad holds under a slow line.
    calm: {
      lead: bars(
        'e5 . . . . . . . g5 . . . f5 . . .',
        'e5 . . . . . . . - - - - b4 . c5 .',
        'c5 . . . . . . . d5 . . . b4 . . .',
        'e5 . . . . . . . - - - - - - - -',
      ),
      harmony: bars(
        'b3 . . . . . . . . . . . . . . .',
        'g3 . . . . . . . . . . . . . . .',
        'a3 . . . . . . . . . . . . . . .',
        'f3 . . . . . . . b3 . . . . . . .',
      ),
      bass: bars(
        'e2 . . . . . . . e2 . . . . . . .',
        'e2 . . . . . . . e2 . . . . . . .',
        'a1 . . . . . . . a1 . . . . . . .',
        'f2 . . . . . . . b1 . . . . . . .',
      ),
      drums: '- - - - - - - - h - - - - - - -',
    },
    // A wave: a galloping bass under the lead and a thin arpeggio.
    battle: {
      lead: bars(
        'e5 . . b4 . . e5 . f5 . e5 . d5 . b4 .',
        'c5 . . a4 . . c5 . d5 . c5 . b4 . . .',
        'e5 . . b4 . . e5 . g5 . f5 . e5 . d5 .',
        'f5 . e5 . d5 . c5 . b4 . . . - - - -',
      ),
      harmony: bars(
        'e4 - g4 - b4 - g4 - e4 - g4 - b4 - g4 -',
        'a3 - c4 - e4 - c4 - a3 - c4 - e4 - c4 -',
        'e4 - g4 - b4 - g4 - e4 - g4 - b4 - g4 -',
        'f4 - a4 - c5 - a4 - b3 - d4 - f4 - d4 -',
      ),
      bass: bars(
        'e2 - e2 e3 e2 - e2 e3 e2 - e2 e3 e2 - d2 -',
        'a1 - a1 a2 a1 - a1 a2 a1 - a1 a2 a1 - g1 -',
        'e2 - e2 e3 e2 - e2 e3 e2 - e2 e3 e2 - d2 -',
        'f2 - f2 f3 f2 - f2 f3 b1 - b1 b2 b1 - d2 -',
      ),
      drums: 'k - h - s - h k k - h - s - h h',
    },
    // A frenzy: the battle with double hats.
    frenzy: {
      lead: bars(
        'e5 . . b4 . . e5 . f5 . e5 . d5 . b4 .',
        'c5 . . a4 . . c5 . d5 . c5 . b4 . . .',
        'e5 . . b4 . . e5 . g5 . f5 . e5 . d5 .',
        'f5 . e5 . d5 . c5 . b4 . . . - - - -',
      ),
      harmony: bars(
        'e4 g4 b4 e5 b4 g4 e4 g4 b4 e5 b4 g4 e4 g4 b4 g4',
        'a3 c4 e4 a4 e4 c4 a3 c4 e4 a4 e4 c4 a3 c4 e4 c4',
        'e4 g4 b4 e5 b4 g4 e4 g4 b4 e5 b4 g4 e4 g4 b4 g4',
        'f4 a4 c5 a4 f4 a4 c5 a4 b3 d4 f4 d4 b3 d4 f4 d4',
      ),
      bass: bars(
        'e2 - e2 e3 e2 - e2 e3 e2 - e2 e3 e2 - d2 -',
        'a1 - a1 a2 a1 - a1 a2 a1 - a1 a2 a1 - g1 -',
        'e2 - e2 e3 e2 - e2 e3 e2 - e2 e3 e2 - d2 -',
        'f2 - f2 f3 f2 - f2 f3 b1 - b1 b2 b1 - d2 -',
      ),
      drums: 'k h h h s h h k k h h h s h s h',
    },
    // A blackout or a blood moon: low, creeping half steps and a sparse beat.
    dark: {
      lead: bars(
        'e4 . . f4 . . e4 . - - b3 . c4 . . .',
        'e4 . . f4 . . g4 . f4 . e4 . - - - -',
        'bb3 . . . a3 . . . bb3 . . . b3 . . .',
        'e4 . . . . . . . - - - - - - - -',
      ),
      harmony: bars(
        'b3 . . . . . . . c4 . . . . . . .',
        'b3 . . . . . . . bb3 . . . . . . .',
        'f3 . . . . . . . f3 . . . . . . .',
        'e3 . . . . . . . f3 . . . . . . .',
      ),
      bass: 'e1 . . . e2 - e1 - e1 . . . f1 - e1 -',
      drums: 'k - - - - - h - k - - - s - - -',
    },
    // Stings, played once over the music.
    lose: {
      lead: bars('e5 . . . d5 . . . c5 . . . b4 . . .', 'bb4 . . . . . . . . . . . - - - -'),
      harmony: bars('b4 . . . a4 . . . g4 . . . f4 . . .', 'e4 . . . . . . . . . . . - - - -'),
      bass: bars('e3 . . . d3 . . . c3 . . . b2 . . .', 'e2 . . . . . . . . . . . - - - -'),
      drums: bars('k - - - k - - - k - - - k - - -', 's - - - - - - - - - - - - - - -'),
    },
    win: {
      lead: bars('b4 . e5 . g#5 . b5 . . . g#5 . b5 . . .', 'e6 . . . . . . . . . . . - - - -'),
      harmony: bars('g#4 . b4 . e5 . g#5 . . . e5 . g#5 . . .', 'b5 . . . . . . . . . . . - - - -'),
      bass: bars('e2 . . . e3 . . . e2 . . . b2 . . .', 'e2 . . . . . . . . . . . - - - -'),
      drums: bars('k - h - s - h - k - h - s - s s', 'k - - - - - - - - - - - - - - -'),
    },
    // A boss wave starts: a low two-note horn.
    warn: {
      lead: bars('e4 . . . . . . . bb3 . . . . . . .', 'e4 . . . . . . . bb3 . . . . . - -'),
      bass: bars('e2 . . . . . . . bb1 . . . . . . .', 'e2 . . . . . . . bb1 . . . . . - -'),
      drums: bars('k - - - - - - - k - - - - - - -', 'k - - - - - - - k - - - - - - -'),
    },
  },
};

/** The boss waves' song: heavier and faster, with the diminished fifth in it. */
export const BOSS_SONG: Song = {
  bpm: 150,
  waves: { lead: 'square', harmony: 'pulse12' },
  mix: { lead: 0.13, harmony: 0.06, bass: 0.3 },
  parts: {
    boss: {
      lead: bars(
        'e5 . e5 . f5 . e5 . bb4 . . . b4 . . .',
        'e5 . e5 . f5 . g5 . f5 . e5 . d5 . f5 .',
        'e5 . e5 . f5 . e5 . c5 . . . b4 . . .',
        'a4 . b4 . c5 . d5 . f5 . e5 . . . - -',
      ),
      harmony: 'e4 - e4 - e4 - f4 - e4 - e4 - bb3 - b3 -',
      bass: 'e1 e2 e1 e2 e1 e2 f1 f2 e1 e2 e1 e2 bb1 bb2 b1 b2',
      drums: 'k - h k s - h - k k h - s - s s',
    },
  },
};
