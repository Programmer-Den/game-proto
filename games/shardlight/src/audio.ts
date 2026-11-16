import { sounds, type Song } from '../../../shared/audio';

/**
 * Shardlight's sound: a slow chapel tune in F on the map, a brisker part while a window is played,
 * a darker one for the rose windows, and stings for a window restored or lost. The sim in `game/`
 * stays free of sound; the scene plays these for the sim's events.
 */

const held = (note: string) => `${note} ${'. '.repeat(15)}`.trim();

export const SONG: Song = {
  bpm: 92,
  mix: { lead: 0.09, harmony: 0.05, bass: 0.14, drums: 0.06 },
  waves: { lead: 'triangle', harmony: 'pulse25' },
  parts: {
    /** The map and the workshop. */
    calm: {
      lead: [
        'f4 . . . a4 . c5 . . . bb4 . a4 . . .',
        'g4 . . . bb4 . d5 . . . c5 . bb4 . . .',
        'a4 . . . c5 . f5 . . . e5 . c5 . . .',
        'd5 . c5 . bb4 . g4 . f4 . . . - . . .',
      ].join(' | '),
      harmony: [held('c4'), held('d4'), held('c4'), held('bb3')].join(' | '),
      bass: [held('f2'), held('bb2'), held('a2'), 'c3 . . . . . . . f2 . . . . . . .'].join(' | '),
      drums: 'k - - - - - - - h - - - - - - -',
    },
    /** A window under way. */
    battle: {
      lead: ['c5 . a4 . f4 . a4 . c5 . d5 . c5 . a4 .', 'bb4 . g4 . e4 . g4 . bb4 . c5 . bb4 . g4 .'].join(' | '),
      harmony: [held('f4'), held('e4')].join(' | '),
      bass: ['f2 . f2 . c3 . f2 . f2 . f2 . c3 . a2 .', 'c2 . c2 . g2 . c2 . c2 . c2 . g2 . e2 .'].join(' | '),
      drums: 'k - h - s - h - k - k h s - h -',
    },
    /** A rose window. */
    boss: {
      lead: ['d5 . . a4 . . d5 . e5 . f5 . e5 . d5 .', 'c5 . . g4 . . c5 . d5 . e5 . c#5 . a4 .'].join(' | '),
      harmony: [held('a4'), held('g4')].join(' | '),
      bass: ['d2 . d2 . d2 . a2 . d2 . d2 . a2 . f2 .', 'a1 . a1 . a1 . e2 . a1 . a1 . e2 . c#2 .'].join(' | '),
      drums: 'k - h k s - h - k - h k s - s h',
    },
    /** Sting: a window restored. */
    win: {
      lead: 'f4 . a4 . c5 . f5 . . . a5 . . . . .',
      harmony: 'c4 . f4 . a4 . c5 . . . f5 . . . . .',
      bass: 'f2 . . . . . . . f2 . . . . . . .',
      drums: 'k - - - s - - - k - - - - - - -',
    },
    /** Sting: the orbs are spent. */
    lose: {
      lead: 'c5 . . . a4 . . . g4 . . . f4 . . .',
      bass: 'f2 . . . . . . . f1 . . . . . . .',
      drums: 'k - - - - - - - k - - - - - - -',
    },
  },
};

export const SFX = sounds({
  /** The orb bounces off the bar. */
  bar: { wave: 'triangle', freq: 330, to: 440, length: 0.08, volume: 0.28, gap: 50 },
  /** The orb bounces off a wall. */
  wall: { wave: 'triangle', freq: 220, length: 0.04, volume: 0.12, gap: 60 },
  /** A pane breaks: a glassy chime, played higher along a chain. */
  shatter: { wave: 'square', freq: 1320, to: 1760, length: 0.09, volume: 0.16, gap: 30, vary: 0.04 },
  /** The tinkle of falling shards under the chime. */
  tinkle: { wave: 'noise', freq: 6000, to: 9000, length: 0.12, volume: 0.08, gap: 50 },
  /** A thick pane cracks. */
  crack: { wave: 'noise', freq: 2400, to: 900, length: 0.08, volume: 0.18, gap: 40 },
  /** The orb rings off a lead pane. */
  clang: { wave: 'square', freq: 196, to: 180, length: 0.14, volume: 0.18, gap: 60 },
  /** A bead drops out of a pane. */
  drop: { wave: 'sine', freq: 880, to: 660, length: 0.1, volume: 0.15, gap: 80 },
  /** A good bead caught. */
  catch: { wave: 'pulse25', freq: 660, arp: [0, 4, 7], arpStep: 0.05, length: 0.2, volume: 0.22, gap: 80 },
  /** A bad bead caught. */
  curse: { wave: 'sawtooth', freq: 300, to: 180, length: 0.22, volume: 0.18, gap: 80 },
  /** The orb leaves the bar. */
  launch: { wave: 'sine', freq: 440, to: 880, length: 0.12, volume: 0.2, gap: 100 },
  /** An orb falls past the bar. */
  lost: { wave: 'triangle', freq: 392, to: 98, length: 0.45, volume: 0.3, gap: 200 },
});
