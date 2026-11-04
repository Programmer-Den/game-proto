import { sounds, type Song } from '../../../../shared/audio';

/**
 * Lanternkeep's sound effects, synthesized by `shared/audio.ts`: soft flutters, match strikes and
 * bells for a shadow-puppet theatre at dusk. `cues.ts` decides when each one plays.
 */
export const sfx = sounds({
  /** A moth leaves the jar for a lantern. */
  flutter: { wave: 'noise', freq: 1800, to: 900, length: 0.14, attack: 0.03, volume: 0.22, gap: 60, vary: 0.1 },
  /** A tap waits in the queue for a moth. */
  pip: { wave: 'square', freq: 1320, length: 0.05, volume: 0.16, gap: 60, vary: 0.03 },
  /** A moth puts the match to a lantern: a scratch, then the warm flame. */
  strike: { wave: 'noise', freq: 6000, to: 2500, length: 0.06, volume: 0.2, gap: 80 },
  fwoomp: { wave: 'sine', freq: 170, to: 330, length: 0.26, attack: 0.04, volume: 0.38, gap: 80, vary: 0.05 },
  /** A close-call refill: a sparkle over the coin. */
  sparkle: { wave: 'pulse25', freq: 1047, arp: [0, 7, 12, 19], arpStep: 0.04, length: 0.22, volume: 0.22, gap: 120 },
  /** A moth finds the cask dry. */
  clunk: { wave: 'triangle', freq: 150, to: 70, length: 0.16, volume: 0.45, gap: 150 },
  /** One or more lanterns go dark (burnt out, blown, snuffed); merged into one per frame. */
  fizzle: { wave: 'noise', freq: 4000, to: 700, length: 0.32, attack: 0.01, volume: 0.22, gap: 120, vary: 0.08 },
  /** A gust is warned: the wind rises. */
  windSwell: { wave: 'noise', freq: 380, to: 900, length: 0.9, attack: 0.5, volume: 0.2, gap: 500 },
  /** The gust blows through. */
  gust: { wave: 'noise', freq: 900, to: 260, length: 0.5, attack: 0.05, volume: 0.28, gap: 300 },
  /** A moth on the lantern kept it lit against a gust or the owl. */
  ting: { wave: 'sine', freq: 1760, length: 0.32, volume: 0.24, gap: 100, vary: 0.02 },
  /** A bat flaps in from the edge. */
  squeak: { wave: 'pulse12', freq: 2600, to: 3300, length: 0.08, volume: 0.13, gap: 200, vary: 0.06 },
  /** A bat reached a guarded lantern and bounces off. */
  bounce: { wave: 'triangle', freq: 300, to: 620, length: 0.12, volume: 0.3, gap: 100 },
  /** A moth chases a bat off: a whoosh as it flees. */
  whoosh: { wave: 'noise', freq: 1200, to: 3200, length: 0.2, attack: 0.03, volume: 0.22, gap: 100 },
  /** The Great Owl is warned: a distant two-note hoot. */
  hoot: { wave: 'sine', freq: 392, arp: [0, 0, -3, -3], arpStep: 0.16, length: 0.62, attack: 0.06, volume: 0.32, gap: 1000 },
  /** The owl sweeps its row. */
  sweep: { wave: 'noise', freq: 300, to: 1300, length: 0.8, attack: 0.25, volume: 0.28, gap: 1000 },
  /** A cottage window calls for a lantern: a door chime. */
  chime: { wave: 'triangle', freq: 784, arp: [0, -4], arpStep: 0.18, length: 0.45, volume: 0.3, gap: 300 },
  /** A window's call answered in time. */
  callKept: { wave: 'triangle', freq: 659, arp: [0, 4, 7], arpStep: 0.07, length: 0.3, volume: 0.28, gap: 200 },
  /** A window's call ran out. */
  callLost: { wave: 'triangle', freq: 330, to: 220, length: 0.42, volume: 0.24, gap: 200 },
  /** The harbour's tide is warned: a far-off swell; it rises with a wash over the quay (LK15). */
  swellSea: { wave: 'noise', freq: 220, to: 520, length: 1.1, attack: 0.6, volume: 0.2, gap: 1000 },
  wash: { wave: 'noise', freq: 700, to: 180, length: 0.9, attack: 0.08, volume: 0.3, gap: 1000 },
  /** A ship comes in sight: a low horn. */
  horn: { wave: 'triangle', freq: 147, arp: [0, 0, 5], arpStep: 0.25, length: 0.9, attack: 0.1, volume: 0.32, gap: 1000 },
  /** The monastery (LK20): an avalanche warned, the snow coming down, and a bell rung for a pilgrim. */
  crack: { wave: 'noise', freq: 2400, to: 500, length: 0.35, attack: 0.01, volume: 0.26, gap: 1000 },
  slide: { wave: 'noise', freq: 500, to: 90, length: 1.2, attack: 0.15, volume: 0.32, gap: 1000 },
  peal: { wave: 'triangle', freq: 988, arp: [0, 7, 12, 7], arpStep: 0.12, length: 0.7, volume: 0.28, gap: 300 },
  /** A moth grows a trait (LK16): a bright rising bloom. */
  bloom: { wave: 'triangle', freq: 880, arp: [0, 4, 7, 11, 14], arpStep: 0.06, length: 0.4, volume: 0.26, gap: 300 },
  /** A moth comes home tired and rests. */
  yawn: { wave: 'sine', freq: 660, to: 440, length: 0.2, volume: 0.18, gap: 200, vary: 0.05 },
  /** A moth swaps jars. */
  swap: { wave: 'noise', freq: 2400, to: 1600, length: 0.08, attack: 0.02, volume: 0.16, gap: 80 },
  /** Nightfall: the bell tolls before the coins. */
  toll: { wave: 'triangle', freq: 220, length: 1.4, volume: 0.4, gap: 1000 },
  /** A hearth goes out: a deep thud and a minor chord. */
  thud: { wave: 'sine', freq: 110, to: 40, length: 0.5, volume: 0.5, gap: 500 },
  minor: { wave: 'triangle', freq: 220, arp: [0, 3, 7], arpStep: 0.09, length: 0.7, volume: 0.28, gap: 500 },
  /** Buying an upgrade. */
  kaching: { wave: 'pulse25', freq: 1319, arp: [0, 4, 7, 12], arpStep: 0.04, length: 0.22, volume: 0.24, gap: 100 },
  /** Topping up the cask. */
  glug: { wave: 'sine', freq: 300, to: 160, arp: [0, 5, 0, 5], arpStep: 0.06, length: 0.26, volume: 0.32, gap: 100 },
  /** Rekindling a hearth: the fire swells. */
  swell: { wave: 'noise', freq: 300, to: 1400, length: 0.55, attack: 0.25, volume: 0.28, gap: 300 },
  /** The next dusk begins: an evening chime. */
  evening: { wave: 'triangle', freq: 1319, arp: [0, -5, -8, -12], arpStep: 0.12, length: 0.6, volume: 0.26, gap: 300 },
  /** The keep moves to another district: a cart rumbles off. */
  rumble: { wave: 'noise', freq: 120, to: 70, length: 0.6, attack: 0.08, volume: 0.34, gap: 300 },
  /** A curse is taken: an ominous low pluck. */
  pluck: { wave: 'square', freq: 110, to: 104, arp: [0, 1], arpStep: 0.15, length: 0.5, volume: 0.2, gap: 200 },
});

export type SoundName = Parameters<typeof sfx>[0];

/**
 * Music-box folk in A minor at 108 BPM, in eighth notes (8 steps a bar): a triangle lead like a
 * music box, a thin pulse pizzicato arpeggio, a triangle bass and a soft shaker.
 *
 * - `dusk`: a clear dusk. `fog`, `feast` and `storm`: the other kinds of night (sparse and muted,
 *   a bouncy dance, and driving with rain on the hats).
 * - `late`: the last 10 seconds of any dusk, a pulsing bass under a ticking clock.
 * - `lullaby`: the night panel, the district choice, the curses and the game over.
 * - Stings: `festival` (the Great Festival), `over` (the keep goes dark).
 */
export const SONG: Song = {
  bpm: 108,
  steps: 2,
  mix: { lead: 0.2, harmony: 0.05, bass: 0.22, drums: 0.14 },
  waves: { lead: 'triangle', harmony: 'pulse12', bass: 'triangle' },
  parts: {
    dusk: {
      lead: `e5 . a4 b4 c5 . b4 a4 | c5 . f5 . e5 d5 c5 . | e5 . g5 . e5 d5 c5 d5 | d5 . . . b4 . g4 . |
             a4 . c5 e5 a5 . g5 e5 | f5 . e5 d5 a4 . d5 . | e5 . d5 c5 b4 . g#4 . | a4 . . . - - - -`,
      harmony: `a3 e4 c4 e4 a3 e4 c4 e4 | f3 c4 a3 c4 f3 c4 a3 c4 | c4 g4 e4 g4 c4 g4 e4 g4 | g3 d4 b3 d4 g3 d4 b3 d4 |
                a3 e4 c4 e4 a3 e4 c4 e4 | d4 a4 f4 a4 d4 a4 f4 a4 | e3 b3 g#3 b3 e3 b3 g#3 b3 | a3 e4 c4 e4 a3 - - -`,
      bass: `a2 . . . e3 . . . | f2 . . . c3 . . . | c3 . . . g2 . . . | g2 . . . d3 . . . |
             a2 . . . e3 . . . | d3 . . . a2 . . . | e2 . . . b2 . . . | a2 . . . a2 . . .`,
      drums: 'k - h - h - h h',
    },
    fog: {
      lead: `e5 . . . . . . . | c5 . . . a4 . . . | g4 . . . c5 . . . | b4 . . . . . . . |
             a4 . . . e5 . . . | f5 . . . d5 . . . | e5 . . . g#4 . . . | a4 . . . . . . .`,
      harmony: `a3 - e4 - c4 - e4 - | f3 - c4 - a3 - c4 - | c4 - g4 - e4 - g4 - | g3 - d4 - b3 - d4 - |
                a3 - e4 - c4 - e4 - | d4 - a4 - f4 - a4 - | e3 - b3 - g#3 - b3 - | a3 - e4 - c4 - - -`,
      bass: `a2 . . . . . . . | f2 . . . . . . . | c3 . . . . . . . | g2 . . . . . . . |
             a2 . . . . . . . | d3 . . . . . . . | e2 . . . . . . . | a2 . . . . . . .`,
      drums: '- - h - - - h -',
    },
    feast: {
      lead: `a4 c5 e5 c5 a4 c5 e5 a5 | g5 . d5 . b4 d5 g5 . | a5 g5 f5 e5 f5 . c5 . | e5 d5 c5 b4 g#4 . e4 . |
             a4 c5 e5 a5 g5 e5 c5 e5 | d5 g5 b5 g5 d5 . b4 . | c5 a4 f5 . e5 d5 b4 g#4 | a4 . e5 . a5 . - -`,
      harmony: `- e4 - e4 - e4 - e4 | - d4 - d4 - d4 - d4 | - c4 - c4 - c4 - c4 | - b3 - b3 - g#3 - g#3 |
                - e4 - e4 - e4 - e4 | - d4 - d4 - d4 - d4 | - c4 - c4 - b3 - b3 | - e4 - e4 - c4 - -`,
      bass: `a2 - e3 - a2 - e3 - | g2 - d3 - g2 - d3 - | f2 - c3 - f2 - c3 - | e2 - b2 - e2 - b2 - |
             a2 - e3 - a2 - e3 - | g2 - d3 - g2 - d3 - | f2 - c3 - e2 - b2 - | a2 - e3 - a2 - - -`,
      drums: 'k h s h k h s h',
    },
    storm: {
      lead: `a4 . . c5 b4 . a4 . | e5 . . d5 c5 . b4 . | c5 . . a4 f5 . e5 . | e5 . d5 . b4 . g#4 . |
             d5 . . f5 e5 . d5 . | c5 . . e5 a5 . e5 . | g#5 . f5 . e5 . d5 . | c5 . b4 . a4 . . .`,
      harmony: `a3 e4 a3 e4 a3 e4 a3 e4 | a3 e4 a3 e4 a3 e4 a3 e4 | f3 c4 f3 c4 f3 c4 f3 c4 | e3 b3 e3 b3 e3 b3 e3 b3 |
                d4 a4 d4 a4 d4 a4 d4 a4 | a3 e4 a3 e4 a3 e4 a3 e4 | e3 b3 e3 b3 e3 b3 e3 b3 | a3 e4 a3 e4 a3 - - -`,
      bass: `a2 a2 a3 a2 a2 a2 a3 a2 | a2 a2 a3 a2 a2 a2 a3 a2 | f2 f2 f3 f2 f2 f2 f3 f2 | e2 e2 e3 e2 e2 e2 e3 e2 |
             d2 d2 d3 d2 d2 d2 d3 d2 | a2 a2 a3 a2 a2 a2 a3 a2 | e2 e2 e3 e2 e2 e2 e3 e2 | a2 a2 a3 a2 a2 . . .`,
      drums: 'k h s h k k s h',
    },
    late: {
      lead: `e5 . e5 d5 e5 . f5 e5 | e5 . e5 d5 c5 . b4 . | f5 . f5 e5 f5 . g5 f5 | e5 . d5 . c5 . b4 .`,
      harmony: `a3 e4 a3 e4 a3 e4 a3 e4 | g#3 e4 g#3 e4 g#3 e4 g#3 e4 | a3 f4 a3 f4 a3 f4 a3 f4 | g#3 e4 g#3 e4 g#3 d4 g#3 d4`,
      bass: `a2 a2 a2 a2 a2 a2 a2 a2 | e2 e2 e2 e2 e2 e2 e2 e2 | f2 f2 f2 f2 f2 f2 f2 f2 | e2 e2 e2 e2 e2 e2 e2 e2`,
      drums: 'k h h h k h h h',
    },
    lullaby: {
      lead: `a4 . c5 . e5 . . . | f5 . e5 . c5 . . . | e5 . d5 . c5 . g4 . | b4 . . . . . . . |
             a4 . c5 . e5 . a5 . | g5 . f5 . e5 . c5 . | d5 . c5 . b4 . g#4 . | a4 . . . . . . .`,
      harmony: `a3 . e4 . c4 . e4 . | f3 . c4 . a3 . c4 . | c4 . g4 . e4 . g4 . | e3 . b3 . g#3 . b3 . |
                a3 . e4 . c4 . e4 . | f3 . c4 . a3 . c4 . | d4 . a4 . e3 . b3 . | a3 . e4 . c4 . . .`,
      bass: `a2 . . . . . . . | f2 . . . . . . . | c3 . . . . . . . | e2 . . . . . . . |
             a2 . . . . . . . | f2 . . . . . . . | d3 . . . e2 . . . | a2 . . . . . . .`,
      drums: '- - - - h - - -',
    },
    festival: {
      lead: 'c5 e5 g5 c6 . . g5 c6 | e6 . . . d6 . c6 . | c6 . . . . . . -',
      harmony: 'e4 g4 c5 e5 . . c5 e5 | g5 . . . f5 . e5 . | e5 . . . . . . -',
      bass: 'c3 . . . g2 . . . | c3 . . . g2 . . . | c3 . . . . . . -',
      drums: 'k - s - k k s - | k - s - k - s s | k - - - - - - -',
    },
    over: {
      lead: 'e5 . d5 . c5 . b4 . | a4 . g#4 . a4 . . . | . . . . - - - -',
      harmony: 'c4 . b3 . a3 . g#3 . | f3 . e3 . e3 . . . | . . . . - - - -',
      bass: 'a2 . . . e2 . . . | f2 . e2 . a1 . . . | . . . . - - - -',
      drums: 'k - - - - - - - | k - - - - - - - | - - - - - - - -',
    },
  },
};
