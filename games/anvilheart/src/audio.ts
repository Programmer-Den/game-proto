import { sounds, type Song } from '../../../shared/audio';

/**
 * Anvilheart's sound: a folk groove in C major at 108 BPM (square lead, pulse plucks, triangle
 * bass, hammer-clink drums) and the smithy's sound effects. `GameScene` plays them from the events
 * it drains in `drawEvents` and from the player's own taps; the sim has no sound in it.
 */
export const SONG: Song = {
  bpm: 108,
  waves: { lead: 'square', harmony: 'pulse12', bass: 'triangle' },
  mix: { lead: 0.12, harmony: 0.07, bass: 0.24, drums: 0.22 },
  parts: {
    /** The smithy at work: C, F, G, C, Am, F, G, C. */
    calm: {
      lead: [
        'e5 . . g5 . . c6 . b5 . a5 . g5 . . .',
        'a5 . . f5 . . a5 . c6 . a5 . g5 . f5 .',
        'g5 . . d5 . . g5 . b5 . a5 . g5 . f5 .',
        'e5 . . . g5 . e5 . c5 . . . - - - -',
        'c5 . . e5 . . a5 . g5 . e5 . c5 . . .',
        'f5 . . a5 . . c6 . a5 . f5 . a5 . . .',
        'g5 . b5 . d6 . b5 . a5 . g5 . f5 . d5 .',
        'c5 . . . e5 . g5 . c6 . . . - - - -',
      ].join(' | '),
      harmony: [
        '- - e4 - - - g4 - - - e4 - - - g4 -',
        '- - f4 - - - a4 - - - f4 - - - a4 -',
        '- - d4 - - - g4 - - - d4 - - - b4 -',
        '- - e4 - - - g4 - - - e4 - - - g4 -',
        '- - c4 - - - e4 - - - c4 - - - e4 -',
        '- - f4 - - - a4 - - - f4 - - - a4 -',
        '- - d4 - - - g4 - - - d4 - - - b4 -',
        '- - e4 - - - g4 - - - c5 - - - - -',
      ].join(' | '),
      bass: [
        'c3 . . . g2 . . . c3 . . . g2 . e2 .',
        'f2 . . . c3 . . . f2 . . . c3 . a2 .',
        'g2 . . . d3 . . . g2 . . . d3 . b2 .',
        'c3 . . . g2 . . . c3 . . . g2 . e2 .',
        'a2 . . . e3 . . . a2 . . . e3 . c3 .',
        'f2 . . . c3 . . . f2 . . . c3 . a2 .',
        'g2 . . . d3 . . . g2 . . . d3 . b2 .',
        'c3 . . . g2 . . . c3 . . . c3 . . .',
      ].join(' | '),
      drums: 'k - h - s - h - k k h - s - h h',
    },
    /** A hammer streak running: the same chords, busier. */
    streak: {
      lead: [
        'c5 e5 g5 c6 g5 e5 c5 e5 g5 c6 e6 c6 g5 e5 g5 c6',
        'b4 d5 g5 b5 g5 d5 b4 d5 g5 b5 d6 b5 g5 d5 g5 b5',
      ].join(' | '),
      harmony: 'c5 . . . . . . . e5 . . . . . . . | d5 . . . . . . . b4 . . . . . . .',
      bass: 'c3 - c3 - g2 - c3 - c3 - c3 - g2 - e2 - | g2 - g2 - d3 - g2 - g2 - g2 - d3 - b2 -',
      drums: 'k h h h s h h k k h h h s h s s',
    },
    /** The crown's offer or a new charter's edict waiting: high and held, in A minor. */
    tense: {
      lead: [
        'a5 . . . . . c6 . b5 . . . e5 . . .',
        'f5 . . . . . a5 . g#5 . . . e5 . . .',
        'a5 . . . . . c6 . d6 . . . b5 . . .',
        'c6 . . . b5 . . . g#5 . . . e5 . . .',
      ].join(' | '),
      harmony: [
        'e5 - e5 - e5 - e5 - c5 - c5 - c5 - c5 -',
        'c5 - c5 - c5 - c5 - b4 - b4 - b4 - b4 -',
        'f5 - f5 - f5 - f5 - d5 - d5 - d5 - d5 -',
        'e5 - e5 - e5 - e5 - d5 - d5 - d5 - d5 -',
      ].join(' | '),
      bass: [
        'a2 . . . a2 . . . a2 . . . a2 . . .',
        'f2 . . . f2 . . . e2 . . . e2 . . .',
        'd2 . . . d2 . . . f2 . . . f2 . . .',
        'e2 . . . e2 . . . e2 . . . g#2 . . .',
      ].join(' | '),
      drums: 'k - - - h - - - k - - - h - h -',
    },
    /** The Crown Blade delivered: a fanfare with a Lydian lift (D major over C). */
    win: {
      lead: 'c5 . e5 . g5 . c6 . . . . . e6 . . . | d6 . . . f#5 . a5 . d6 . . . e6 . . . | g6 . . . . . . . . . . . . . . .',
      harmony: 'e4 . g4 . c5 . e5 . . . . . g5 . . . | f#4 . a4 . d5 . f#5 . . . . . a5 . . . | e5 . . . . . . . . . . . . . . .',
      bass: 'c3 . . . c3 . . . c3 . . . c3 . . . | d3 . . . d3 . . . d3 . . . d3 . . . | c3 . . . . . . . . . . . . . . .',
      drums: 'k - h - s - h - k - s - s s s s | k - h - s - h - k - s - s s s s | k - - - - - - - - - - - - - - -',
    },
    /** A new smithy founded under a new charter: a rising arpeggio. */
    charter: {
      lead: 'c5 e5 g5 c6 . . d5 f#5 a5 d6 . . e6 . . . | g6 . . . . . . . - - - - - - - -',
      harmony: 'c4 - e4 - g4 - d4 - f#4 - a4 - g4 . . . | b4 . . . . . . . - - - - - - - -',
      bass: 'c3 . . . . . d3 . . . . . g2 . . . | c3 . . . . . . . - - - - - - - -',
      drums: 'h h h h h h h h s s s s k - k - | k - - - - - - - - - - - - - - -',
    },
  },
};

/** The smithy's sound effects. */
export const sfx = sounds({
  /** The forge puts out a sword, gem or buckler: a hiss of steam, then a clink. */
  hiss: { wave: 'noise', freq: 9000, to: 3000, length: 0.2, volume: 0.12, gap: 120 },
  clink: { wave: 'pulse12', freq: 1760, to: 1700, length: 0.09, volume: 0.18, gap: 120, vary: 0.04 },
  /** A sword picked up: a light scrape of metal. */
  pick: { wave: 'noise', freq: 4000, to: 7000, length: 0.06, volume: 0.1, gap: 60 },
  /** A sword put down, moved or swapped: a soft clunk. */
  place: { wave: 'triangle', freq: 260, to: 120, length: 0.08, volume: 0.4, gap: 60, vary: 0.05 },
  /** Two swords merged: an anvil clang, pitched up with the tier. */
  clang: { wave: 'pulse25', freq: 784, to: 760, arp: [12, 0], arpStep: 0.015, length: 0.32, volume: 0.26, gap: 60, vary: 0.02 },
  /** A hammer streak: a clang and a run of coins, pitched up with the streak. */
  streak: { wave: 'square', freq: 1046, arp: [0, 4, 7, 12], arpStep: 0.05, length: 0.26, volume: 0.2, gap: 80 },
  /** A Masterwork strike: a bright bell chord. */
  master: { wave: 'triangle', freq: 1568, arp: [0, 4, 7, 12, 16], arpStep: 0.04, length: 0.6, volume: 0.4, gap: 200 },
  /** A gem set in a sword: a crystalline ping. */
  gem: { wave: 'sine', freq: 2093, to: 2350, length: 0.28, volume: 0.32, gap: 80 },
  /** A battered sword repaired: a hammer tap (played twice). */
  tap: { wave: 'pulse25', freq: 1318, to: 1100, length: 0.05, volume: 0.22, gap: 60 },
  /** A sword rusts down a tier: a dull, detuned thud. */
  /** Something thrown in the scrap bin: a low iron clatter. */
  scrap: { wave: 'noise', freq: 900, to: 300, length: 0.22, volume: 0.3, gap: 120 },
  rust: { wave: 'triangle', freq: 120, to: 70, length: 0.28, volume: 0.45, gap: 200, vary: 0.04 },
  /** An exact fit sold: a ka-ching with the tip's sparkle (a plain sale plays the shared coin). */
  exact: { wave: 'square', freq: 1318, arp: [0, 4, 7, 12], arpStep: 0.045, length: 0.3, volume: 0.24, gap: 80 },
  /** Half of a sword and buckler set handed over. */
  handed: { wave: 'triangle', freq: 440, to: 560, length: 0.1, volume: 0.35, gap: 80 },
  /** An adventurer comes to the counter: a door bell. */
  bell: { wave: 'sine', freq: 1568, arp: [0, -4], arpStep: 0.13, length: 0.4, volume: 0.22, gap: 300 },
  /** A hero comes back from the quest with a trophy: a proud three-note motif. */
  hero: { wave: 'pulse25', freq: 784, arp: [0, 4, 7], arpStep: 0.11, length: 0.45, volume: 0.24, gap: 300 },
  /** An adventurer walks off unhappy: a grumpy falling slide. */
  grumble: { wave: 'square', freq: 330, to: 160, length: 0.32, volume: 0.16, gap: 200 },
  /** A sword delivered to the crown: a regal chime. */
  chime: { wave: 'triangle', freq: 1046, arp: [0, 7, 12], arpStep: 0.07, length: 0.38, volume: 0.38, gap: 120 },
  /** A commission completed: a short fanfare. */
  fanfare: { wave: 'pulse25', freq: 523, arp: [0, 4, 7, 12, 7, 12], arpStep: 0.08, length: 0.62, volume: 0.26, gap: 300 },
  /** An edict or the crown's offer chosen: a wax seal pressed. */
  seal: { wave: 'triangle', freq: 180, to: 60, length: 0.18, volume: 0.45, gap: 150 },
  /** An upgrade, the row, the barrel or a perk bought: a coin blip. */
  buy: { wave: 'square', freq: 660, arp: [0, 7, 12], arpStep: 0.04, length: 0.14, volume: 0.22, gap: 80 },
});

export type SoundName = Parameters<typeof sfx>[0];
