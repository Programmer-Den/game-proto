import { sounds, type Song } from '../../../shared/audio';

/**
 * Mapmaker's sound: a cartographer's desk. The effects are short and soft (pen scratches, ticks,
 * chimes); the music is a light exploring tune in F Lydian at 92 BPM, in eighth notes, with a plucky
 * pulse lead and a triangle bass. `GameScene` plays both, only on the player's own taps, never while
 * a save is loaded.
 */
export const sfx = sounds({
  /** A survey's pen stroke, under the blip. */
  scratch: { wave: 'noise', freq: 6000, to: 2500, length: 0.07, volume: 0.16, vary: 0.08 },
  /** A survey's blip; `GameScene` lowers its pitch for the dearer tiles. */
  blip: { wave: 'pulse25', freq: 660, to: 880, length: 0.08, volume: 0.25, vary: 0.03 },
  /** A lookout's sonar sweep as the viewshed ring grows. */
  sweep: { wave: 'sine', freq: 360, to: 1100, length: 0.55, attack: 0.06, volume: 0.28, gap: 200 },
  /** A tile the viewshed ring passes. */
  tick: { wave: 'triangle', freq: 1320, length: 0.03, volume: 0.2, gap: 35, vary: 0.06 },
  /** The viewshed tally adds up. */
  tally: { wave: 'square', freq: 784, arp: [0, 4, 7], arpStep: 0.05, length: 0.2, volume: 0.2 },
  /** A wreck's timbers, then its stores. */
  wreck: { wave: 'sawtooth', freq: 170, to: 120, length: 0.22, volume: 0.16 },
  chime: { wave: 'sine', freq: 1047, arp: [0, 7], arpStep: 0.08, length: 0.35, volume: 0.3 },
  /** A cave's artifact. */
  sparkle: { wave: 'pulse12', freq: 1568, arp: [0, 4, 7, 12], arpStep: 0.04, length: 0.26, volume: 0.2 },
  /** A storm settles on a tile. */
  thunder: { wave: 'noise', freq: 140, to: 40, length: 0.8, attack: 0.02, volume: 0.4, gap: 300 },
  /** The ruins give up the treasure riddle. */
  riddle: { wave: 'triangle', freq: 587, arp: [0, 3, 7, 6], arpStep: 0.12, length: 0.6, volume: 0.35 },
  /** An isle's wonder comes into sight. */
  wonder: { wave: 'triangle', freq: 523, arp: [0, 7, 12, 16, 19], arpStep: 0.1, length: 0.8, volume: 0.32 },
  /** A river, road or wood charted whole. */
  feature: { wave: 'sine', freq: 880, arp: [0, 4, 7, 12], arpStep: 0.07, length: 0.42, volume: 0.3 },
  /** A spade in the ground, then the treasure or nothing. */
  dig: { wave: 'noise', freq: 1600, to: 500, length: 0.13, volume: 0.28, vary: 0.05 },
  treasure: { wave: 'square', freq: 523, arp: [0, 4, 7, 12, 7, 12], arpStep: 0.08, length: 0.6, volume: 0.24 },
  thud: { wave: 'triangle', freq: 120, to: 55, length: 0.16, volume: 0.45 },
  /** A tent's flap and its peg. */
  flap: { wave: 'noise', freq: 2400, to: 700, length: 0.12, volume: 0.22 },
  peg: { wave: 'square', freq: 330, to: 220, length: 0.06, volume: 0.18 },
  /** The rival read the riddle or dug the treasure first. */
  rival: { wave: 'square', freq: 165, arp: [0, 1], arpStep: 0.2, length: 0.45, volume: 0.22, gap: 400 },
  /** The ship's horn: the voyage is over. */
  horn: { wave: 'sawtooth', freq: 110, to: 104, length: 0.7, attack: 0.08, volume: 0.24, gap: 500 },
  /** The sea swelling under the hull as the ship sets sail. */
  swell: { wave: 'noise', freq: 300, to: 900, length: 0.6, attack: 0.3, volume: 0.2 },
  /** A chart sold. */
  coins: { wave: 'square', freq: 988, arp: [0, 5, 12, 17, 24], arpStep: 0.045, length: 0.3, volume: 0.22 },
  /** An isle milestone reached with the sale. */
  milestone: { wave: 'sine', freq: 1319, arp: [0, 5, 12], arpStep: 0.08, length: 0.45, volume: 0.28 },
  /** An upgrade bought. */
  buy: { wave: 'square', freq: 1319, arp: [0, 7], arpStep: 0.04, length: 0.2, volume: 0.22 },
  /** A hand taken aboard. */
  hire: { wave: 'pulse25', freq: 660, arp: [0, 7], arpStep: 0.05, length: 0.13, volume: 0.25 },
  /** A commission card turned. */
  flip: { wave: 'noise', freq: 4000, to: 1800, length: 0.05, volume: 0.2 },
});

/** The survey parts' shared harmony and bass: F, G (the Lydian II), F, G, F, Dm, C, F. */
const BASS = 'f2 . c3 . a2 . c3 . | g2 . d3 . b2 . d3 . | f2 . c3 . a2 . c3 . | g2 . d3 . g2 . . . | f2 . c3 . a2 . c3 . | d2 . a2 . d3 . a2 . | c2 . g2 . c3 . g2 . | f2 . c3 . f2 . . .';
const HARMONY = 'a3 . . . c4 . . . | b3 . . . d4 . . . | a3 . . . e4 . . . | b3 . . . d4 . . . | a3 . . . c4 . . . | f3 . . . a3 . . . | e3 . . . g3 . . . | a3 . . . . . . .';

export const SONG: Song = {
  bpm: 92,
  steps: 2,
  mix: { lead: 0.14, harmony: 0.06, bass: 0.24, drums: 0.18 },
  waves: { lead: 'pulse25', harmony: 'square', bass: 'triangle' },
  parts: {
    /** Surveying a green isle: the plain theme. */
    green: {
      lead: 'f4 . a4 c5 b4 . a4 g4 | a4 . . . c5 . d5 . | e5 . d5 c5 b4 . c5 a4 | g4 . . . - - - - | f4 . a4 c5 d5 . e5 . | f5 . e5 d5 c5 . b4 . | a4 . c5 . g4 . b4 . | f4 . . . . . - -',
      harmony: HARMONY,
      bass: BASS,
      drums: 'k - h - s - h - | k - h - s - h h',
    },
    /** An archipelago: higher and airier, the bass in long notes. */
    archipelago: {
      lead: 'c5 . . f5 . . e5 . | d5 . . . . . c5 . | b4 . . d5 . . c5 . | a4 . . . . . . . | c5 . . f5 . . g5 . | a5 . . g5 . . e5 . | d5 . c5 . b4 . g4 . | f4 . . . . . . .',
      harmony: HARMONY,
      bass: 'f2 . . . c3 . . . | g2 . . . d3 . . . | f2 . . . a2 . . . | g2 . . . . . . . | f2 . . . c3 . . . | d2 . . . a2 . . . | c2 . . . g2 . . . | f2 . . . . . . .',
      drums: 'k - h - - - h - | - - h - k - h -',
    },
    /** A volcanic isle: darker, in D Dorian, with a driving bass. */
    volcanic: {
      lead: 'd4 . f4 . a4 . g4 . | f4 . e4 . d4 . . . | a4 . b4 . c5 . b4 . | a4 . . . e4 . . . | d4 . f4 . a4 . d5 . | c5 . b4 . a4 . g4 . | f4 . e4 . g4 . e4 . | d4 . . . . . - -',
      harmony: 'f3 . . . a3 . . . | f3 . . . a3 . . . | b3 . . . d4 . . . | c4 . . . e4 . . . | f3 . . . a3 . . . | b3 . . . d4 . . . | e3 . . . g3 . . . | f3 . . . a3 . . .',
      bass: 'd2 . d3 . d2 . a2 . | d2 . d3 . d2 . a2 . | g2 . g3 . g2 . d3 . | a2 . a3 . a2 . e2 . | d2 . d3 . d2 . a2 . | g2 . g3 . g2 . d3 . | c2 . c3 . c2 . g2 . | d2 . d3 . d2 . a2 .',
      drums: 'k - h k s - h - | k - h k s - s h',
    },
    /** A jungle isle: bouncy and syncopated. */
    jungle: {
      lead: 'f4 a4 - c5 - a4 b4 . | c5 - a4 - g4 . . . | a4 c5 - e5 - d5 c5 . | b4 - g4 - a4 . . . | f5 e5 - d5 - c5 b4 . | c5 - a4 - g4 . . . | a4 c5 - b4 - g4 e4 . | f4 . . . - - - -',
      harmony: '- a3 - - c4 - - a3 | - b3 - - d4 - - b3',
      bass: 'f2 - f2 c3 - f2 a2 - | g2 - g2 d3 - g2 b2 -',
      drums: 'k - h k s - h h | k h - k s - h -',
    },
    /** The rival is on the isle: an uneasy motif over D minor and E. */
    rival: {
      lead: 'd4 . . . f4 . e4 . | b3 . . . . . - - | d4 . . . f4 . g4 . | f4 . e4 . b3 . . . | a4 . . . g4 . f4 . | e4 . . . b4 . . . | a4 . g4 . f4 . e4 . | d4 . . . . . - -',
      harmony: 'f3 . . . . . . . | g#3 . . . . . . .',
      bass: 'd2 . a2 . d2 . a2 . | e2 . b2 . e2 . b2 .',
      drums: 'k - - - h - - - | k - - k h - - -',
    },
    /** At port, the chart, the harbor and the Royal Atlas page: a bustling loop with a walking bass. */
    harbor: {
      lead: 'c5 a4 c5 f5 e5 d5 c5 a4 | b4 . g4 . d5 . b4 . | c5 a4 c5 f5 g5 f5 e5 d5 | c5 . . . - - c5 d5 | e5 . c5 . a4 . c5 . | d5 . b4 . g4 . b4 . | a4 c5 f5 a5 g5 e5 c5 e5 | f5 . . . - - - -',
      harmony: '- a3 - a3 - a3 - a3 | - b3 - b3 - b3 - b3 | - a3 - a3 - a3 - a3 | - g3 - g3 - g3 - g3 | - c4 - c4 - c4 - c4 | - b3 - b3 - b3 - b3 | - a3 - a3 - g3 - g3 | - a3 - - - - - -',
      bass: 'f2 a2 c3 a2 f2 a2 c3 a2 | g2 b2 d3 b2 g2 b2 d3 b2 | f2 a2 c3 a2 f2 a2 c3 a2 | c2 e2 g2 e2 c2 e2 g2 e2 | a2 c3 e3 c3 a2 c3 e3 c3 | g2 b2 d3 b2 g2 b2 d3 b2 | f2 a2 c3 a2 c2 e2 g2 bb2 | f2 . c3 . f2 . . .',
      drums: 'k h s h k k s h',
    },
    /** Sting: a chart that binds an atlas page. */
    page: {
      lead: 'f4 a4 c5 f5 . e5 g5 . | f5 . . . . . - -',
      harmony: 'a3 c4 f4 a4 . g4 b4 . | a4 . . . . . - -',
      bass: 'f2 . . . c2 . . . | f2 . . . . . - -',
      drums: 'k - - - s - - - | k - - - - - - -',
    },
    /** Sting: the Royal Atlas is complete. */
    royal: {
      lead: 'c5 . c5 c5 f5 . . . | g5 . a5 . b5 . c6 . | a5 . f5 . g5 . e5 . | f5 . . . . . . -',
      harmony: 'a4 . a4 a4 c5 . . . | d5 . f5 . g5 . g5 . | f5 . c5 . d5 . c5 . | a4 . . . . . . -',
      bass: 'f2 . f2 f2 f2 . . . | g2 . g2 . g2 . g2 . | d2 . . . c2 . . . | f2 . . . . . . -',
      drums: 'k - k k s - - - | k - k - k - s s | k - h - k - s - | k - - - s - - -',
    },
  },
};
