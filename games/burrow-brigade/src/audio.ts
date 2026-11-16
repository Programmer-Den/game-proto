import { sounds, type Song } from '../../../shared/audio';

/**
 * Burrow Brigade's sound: a bouncy march in G on the menu, a busier part during a match, and stings
 * for a won or lost match. The effects are played by `game/world.ts` through the scene's hooks, one
 * per blast, bounce or step of an action, each with its own rate limit.
 */

export const SONG: Song = {
  bpm: 132,
  mix: { lead: 0.12, harmony: 0.06, bass: 0.18, drums: 0.12 },
  waves: { lead: 'pulse25', harmony: 'triangle' },
  parts: {
    /** The menu. */
    calm: {
      lead: [
        'g4 . b4 . d5 . b4 . c5 . a4 . f#4 . d4 .',
        'g4 . b4 . d5 . g5 . f#5 . d5 . a4 . . .',
        'e5 . c5 . a4 . c5 . d5 . b4 . g4 . b4 .',
        'a4 . f#4 . d4 . f#4 . g4 . . . - . . .',
      ].join(' | '),
      harmony: ['d4 . . . . . . . c4 . . . . . . .', 'd4 . . . . . . . a3 . . . . . . .', 'c4 . . . . . . . g3 . . . . . . .', 'd4 . . . . . . . b3 . . . . . . .'].join(' | '),
      bass: ['g2 . d2 . g2 . d2 . a2 . d2 . a2 . d2 .', 'g2 . d2 . g2 . d2 . d2 . a2 . d2 . a2 .', 'c3 . g2 . c3 . g2 . g2 . d2 . g2 . d2 .', 'd2 . a2 . d2 . a2 . g2 . d2 . g2 . . .'].join(' | '),
      drums: 'k - h - s - h - k - h k s - h -',
    },
    /** A match under way. */
    battle: {
      lead: [
        'e5 . e5 . b4 . e5 . g5 . f#5 . e5 . b4 .',
        'c5 . c5 . a4 . c5 . d5 . c5 . b4 . . .',
        'e5 . e5 . b4 . e5 . g5 . a5 . b5 . g5 .',
        'f#5 . d5 . b4 . d5 . e5 . . . - . . .',
      ].join(' | '),
      harmony: ['b3 . . . . . . . b3 . . . . . . .', 'a3 . . . . . . . f#3 . . . . . . .'].join(' | '),
      bass: ['e2 . e2 . b2 . e2 . e2 . e2 . b2 . e2 .', 'c2 . c2 . g2 . c2 . d2 . d2 . a2 . d2 .'].join(' | '),
      drums: 'k - h k s - h - k k h - s - h h',
    },
    /** Sting: a match won. */
    win: {
      lead: 'g4 . b4 . d5 . g5 . . . d5 . g5 . . .',
      harmony: 'd4 . g4 . b4 . d5 . . . b4 . d5 . . .',
      bass: 'g2 . . . . . . . g2 . . . . . . .',
      drums: 'k - s - k - s - k - - - - - - -',
    },
    /** Sting: a match lost. */
    lose: {
      lead: 'b4 . . . a4 . . . g4 . . . e4 . . .',
      bass: 'e2 . . . . . . . e1 . . . . . . .',
      drums: 'k - - - - - - - k - - - - - - -',
    },
  },
};

export const SFX = sounds({
  /** A rocket leaves the launcher. */
  launch: { wave: 'noise', freq: 1600, to: 500, length: 0.25, volume: 0.22, gap: 60 },
  /** Something thrown. */
  throw: { wave: 'triangle', freq: 300, to: 520, length: 0.12, volume: 0.16, gap: 60 },
  boom: { wave: 'noise', freq: 500, to: 60, length: 0.55, volume: 0.36, gap: 70 },
  bigBoom: { wave: 'noise', freq: 320, to: 30, length: 0.9, volume: 0.45, gap: 120 },
  smallBoom: { wave: 'noise', freq: 900, to: 120, length: 0.3, volume: 0.26, gap: 50 },
  /** A grenade or a log bumps the ground. */
  bounce: { wave: 'triangle', freq: 200, to: 110, length: 0.08, volume: 0.18, gap: 70 },
  /** The rubber ball. */
  boing: { wave: 'square', freq: 220, to: 660, length: 0.16, volume: 0.13, gap: 70 },
  splash: { wave: 'noise', freq: 2400, to: 400, length: 0.45, volume: 0.24, gap: 120 },
  /** A dynamite fuse lit. */
  fuse: { wave: 'noise', freq: 5200, to: 4200, length: 0.5, volume: 0.1, gap: 300 },
  /** A tripped mine. */
  beep: { wave: 'square', freq: 1320, length: 0.06, volume: 0.12, gap: 90 },
  buzz: { wave: 'sawtooth', freq: 190, to: 230, length: 0.3, volume: 0.06, gap: 400 },
  /** The Storm Bolt strikes. */
  zap: { wave: 'sawtooth', freq: 1800, to: 120, length: 0.35, volume: 0.22, gap: 120 },
  /** The storm cloud gathering. */
  thunder: { wave: 'noise', freq: 140, to: 60, length: 0.9, volume: 0.22, gap: 300 },
  beam: { wave: 'sawtooth', freq: 440, to: 880, length: 0.7, volume: 0.1, gap: 300 },
  dig: { wave: 'noise', freq: 700, to: 250, length: 0.09, volume: 0.12, gap: 110 },
  jump: { wave: 'square', freq: 330, to: 660, length: 0.12, volume: 0.12, gap: 80 },
  land: { wave: 'noise', freq: 400, to: 120, length: 0.1, volume: 0.14, gap: 80 },
  hurt: { wave: 'square', freq: 520, to: 260, length: 0.14, volume: 0.14, gap: 80, vary: 0.08 },
  shield: { wave: 'sine', freq: 660, to: 1320, length: 0.3, volume: 0.16, gap: 150 },
  heal: { wave: 'triangle', freq: 523, arp: [0, 4, 7, 12], arpStep: 0.06, length: 0.36, volume: 0.2, gap: 200 },
  quake: { wave: 'noise', freq: 90, to: 40, length: 1.6, volume: 0.35, gap: 500 },
  /** Out of a Tunnel Hop. */
  pop: { wave: 'sine', freq: 400, to: 1200, length: 0.14, volume: 0.18, gap: 80 },
  /** A paw swipe through the air. */
  whoosh: { wave: 'noise', freq: 3000, to: 900, length: 0.18, volume: 0.14, gap: 80 },
  thud: { wave: 'noise', freq: 260, to: 70, length: 0.2, volume: 0.26, gap: 80 },
  /** A pot, hive or drill cracking open. */
  crack: { wave: 'noise', freq: 3600, to: 1400, length: 0.14, volume: 0.18, gap: 80 },
  /** The Dandelion splitting. */
  split: { wave: 'triangle', freq: 880, arp: [0, 7, 12], arpStep: 0.04, length: 0.16, volume: 0.14, gap: 100 },
  sizzle: { wave: 'noise', freq: 6000, to: 3000, length: 0.6, volume: 0.1, gap: 400 },
  /** A fallen mole turns into a molehill. */
  poof: { wave: 'noise', freq: 1200, to: 300, length: 0.3, volume: 0.16, gap: 120 },
  collect: { wave: 'square', freq: 660, arp: [0, 5, 9], arpStep: 0.05, length: 0.2, volume: 0.16, gap: 120 },
  balloon: { wave: 'triangle', freq: 260, to: 300, length: 0.5, volume: 0.1, gap: 300 },
  /** The last five seconds of a turn. */
  tick: { wave: 'square', freq: 1000, length: 0.04, volume: 0.08, gap: 400 },
});
