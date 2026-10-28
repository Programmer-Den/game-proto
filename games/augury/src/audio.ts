import { sounds, type Song } from '../../../shared/audio';

/**
 * Augury's sound: a slow harp-like tune in D minor for the menu and the calm modes, a quicker,
 * busier part for Blitz, and soft card and chime effects. The scene plays them; the rules in
 * `game/` stay free of sound.
 */

/** A bar of one note held throughout. */
const held = (note: string) => `${note} ${'. '.repeat(15)}`.trim();

export const SONG: Song = {
  bpm: 76,
  mix: { lead: 0.11, harmony: 0.05, bass: 0.18, drums: 0.1 },
  waves: { lead: 'triangle', harmony: 'sine' },
  parts: {
    /** The menu, practice picker and records. */
    menu: {
      lead: ['d5 . . . a5 . . . f5 . . . e5 . . .', 'd5 . . . c6 . . . a5 . . . . . . .'].join(' | '),
      harmony: [held('a4'), held('f4')].join(' | '),
      bass: [held('d2'), held('bb1')].join(' | '),
    },
    /** A puzzle in Endless, Daily, Draft, Practice or pass and play. */
    calm: {
      lead: [
        'd5 . f5 . a5 . . . g5 . f5 . e5 . . .',
        'c5 . e5 . g5 . . . f5 . e5 . d5 . . .',
        'bb4 . d5 . f5 . a5 . g5 . f5 . e5 . . .',
        'a4 . c#5 . e5 . . . d5 . . . - . . .',
      ].join(' | '),
      harmony: [held('a4'), held('g4'), held('f4'), held('e4')].join(' | '),
      bass: [
        'd2 . . . a2 . . . d2 . . . a2 . . .',
        'c2 . . . g2 . . . c2 . . . g2 . . .',
        'bb1 . . . f2 . . . bb1 . . . f2 . . .',
        'a1 . . . e2 . . . a1 . . . . . . .',
      ].join(' | '),
      drums: 'k - - - - - h - - - - - h - - -',
    },
    /** Blitz: the same key, twice as busy. */
    blitz: {
      lead: [
        'd5 f5 a5 f5 d5 f5 a5 d6 c6 a5 g5 a5 f5 e5 d5 e5',
        'bb4 d5 f5 d5 bb4 d5 f5 bb5 a5 f5 e5 f5 c#5 e5 a5 e5',
      ].join(' | '),
      bass: ['d2 . d2 . a2 . d2 . d2 . d2 . a2 . c3 .', 'bb1 . bb1 . f2 . bb1 . a1 . a1 . e2 . a1 .'].join(' | '),
      drums: 'k - h - s - h - k - h k s - h h',
    },
    /** Sting: a run ends with a score. */
    over: {
      lead: 'a4 . d5 . f5 . a5 . . . d6 . . . . .',
      harmony: 'f4 . a4 . d5 . f5 . . . a5 . . . . .',
      bass: 'd2 . . . . . . . d2 . . . . . . .',
      drums: 'k - - - s - - - k - - - - - - -',
    },
  },
};

export const SFX = sounds({
  /** A cell, island or block picked. */
  tap: { wave: 'triangle', freq: 1300, to: 1100, length: 0.04, volume: 0.14, gap: 30 },
  /** A move made on a puzzle. */
  place: { wave: 'triangle', freq: 660, arp: [0, 7], arpStep: 0.04, length: 0.12, volume: 0.24, vary: 0.04, gap: 25 },
  /** A new puzzle dealt: a card laid down. */
  deal: { wave: 'noise', freq: 2400, to: 900, length: 0.12, volume: 0.14 },
  /** A puzzle solved. */
  solved: { wave: 'triangle', freq: 784, arp: [0, 4, 7, 12], arpStep: 0.06, length: 0.4, volume: 0.3 },
  /** A puzzle lost, skipped or out of time. */
  lost: { wave: 'square', freq: 330, to: 196, length: 0.25, volume: 0.16 },
  /** A heart lost. */
  heart: { wave: 'square', freq: 294, to: 110, arp: [0, -5], arpStep: 0.1, length: 0.3, volume: 0.2, gap: 120 },
  /** A hint used. */
  hint: { wave: 'sine', freq: 880, arp: [0, 4, 7, 12], arpStep: 0.05, length: 0.3, volume: 0.24 },
  /** The last seconds on a clock. */
  warn: { wave: 'pulse25', freq: 1047, length: 0.05, volume: 0.12, gap: 400 },
  /** A Memory Echo card turned. */
  turn: { wave: 'noise', freq: 3200, to: 1600, length: 0.07, volume: 0.1, gap: 60 },
  /** A relic taken. */
  relic: { wave: 'triangle', freq: 523, arp: [0, 7, 12, 19], arpStep: 0.07, length: 0.4, volume: 0.28 },
  /** An omen taken: a low, falling minor chord. */
  omen: { wave: 'square', freq: 220, arp: [0, 3, 7, -5], arpStep: 0.08, length: 0.45, volume: 0.18 },
});
