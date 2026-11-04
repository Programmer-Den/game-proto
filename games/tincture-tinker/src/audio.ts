import { sounds, type Song } from '../../../shared/audio';

/**
 * TinctureTinker's sound: a music-box waltz in F major and a table of soft, glassy effects, all
 * made in code by `shared/audio.ts`. `GameScene` plays them; the rules in `src/game/` stay silent.
 *
 * The waltz runs at 90 beats a minute in 3/4. The engine counts four beats to a bar, so the song is
 * written at 60 BPM with three steps a beat: one step is an eighth note of the waltz, six steps a
 * waltz bar, and the engine's bar of twelve steps holds two waltz bars (a part switch waits for it).
 */
export const SONG: Song = {
  bpm: 60,
  steps: 3,
  // A music box: a soft triangle lead, a thin pulse arpeggio and a triangle bass.
  waves: { lead: 'triangle', harmony: 'pulse12', bass: 'triangle' },
  mix: { lead: 0.2, harmony: 0.055, bass: 0.2, drums: 0.12 },
  parts: {
    // Every order: a gentle waltz, sixteen bars, F - C - Dm - Bb - Gm - C - C7 - F, then a turn
    // through Bb and Dm home.
    calm: {
      lead:
        'a4 . c5 . f5 . | e5 . . d5 c5 . | d5 . f5 . a5 . | f5 . . d5 bb4 . | ' +
        'bb4 . d5 . g5 . | f5 . e5 . d5 . | e5 . g5 . bb5 . | a5 . . f5 . . | ' +
        'd5 . f5 . bb5 . | a5 . . g5 f5 . | g5 . f5 . d5 . | e5 . . . c5 . | ' +
        'f5 . a5 . c6 . | a5 . . f5 d5 . | g5 . e5 . c5 . | f5 . . . . -',
      harmony:
        '- - a3 c4 f4 c4 | - - g3 c4 e4 c4 | - - a3 d4 f4 d4 | - - bb3 d4 f4 d4 | ' +
        '- - bb3 d4 g4 d4 | - - g3 c4 e4 c4 | - - bb3 c4 e4 c4 | - - a3 c4 f4 c4 | ' +
        '- - bb3 d4 f4 d4 | - - a3 c4 f4 c4 | - - bb3 d4 g4 d4 | - - g3 c4 e4 c4 | ' +
        '- - a3 c4 f4 c4 | - - a3 d4 f4 d4 | - - bb3 c4 e4 c4 | - - a3 c4 f4 c4',
      bass:
        'f2 . . . c3 . | c3 . . . g2 . | d2 . . . a2 . | bb1 . . . f2 . | ' +
        'g2 . . . d3 . | c3 . . . g2 . | c3 . . . g2 . | f2 . . . c3 . | ' +
        'bb1 . . . f2 . | a1 . . . c3 . | g2 . . . d3 . | c3 . . . g2 . | ' +
        'f2 . . . c3 . | d2 . . . a2 . | c3 . . . g2 . | f2 . . . c3 .',
    },
    // Royal commissions and guild examinations: a statelier waltz with a dotted lead, octave bass
    // and a soft kick and hats.
    royal: {
      lead:
        'f5 . . c5 f5 a5 | bb5 . . a5 g5 . | a5 . . f5 c5 . | g5 . e5 . c5 . | ' +
        'f5 . . d5 f5 a5 | d6 . . c6 bb5 . | g5 . e5 . c5 e5 | f5 . . . . -',
      harmony:
        '- - a3 . c4 . | - - bb3 . d4 . | - - a3 . c4 . | - - g3 . e4 . | ' +
        '- - a3 . d4 . | - - bb3 . f4 . | - - bb3 . e4 . | - - a3 . c4 .',
      bass:
        'f2 . f3 . f3 . | bb1 . bb2 . bb2 . | f2 . f3 . f3 . | c2 . c3 . c3 . | ' +
        'd2 . d3 . d3 . | bb1 . bb2 . bb2 . | c2 . c3 . c3 . | f2 . f3 . c3 .',
      drums: 'k - h - h - | k - h - h - | k - h - h - | k - h - s -',
    },
    // Three moves or fewer left: the waltz turns to D minor, with running eighths and busier hats.
    tense: {
      lead:
        'd5 f5 a5 f5 d5 f5 | c#5 e5 g5 e5 c#5 a4 | d5 f5 a5 d6 a5 f5 | d5 f5 bb5 f5 d5 bb4 | ' +
        'g4 bb4 d5 g5 d5 bb4 | a4 c#5 e5 a5 e5 c#5 | f5 e5 d5 c5 bb4 a4 | c#5 . e5 . a4 .',
      harmony:
        '- - a3 - a3 - | - - g3 - g3 - | - - a3 - a3 - | - - bb3 - bb3 - | ' +
        '- - bb3 - bb3 - | - - c#4 - c#4 - | - - d4 - d4 - | - - c#4 - e4 -',
      bass:
        'd2 . a2 . a2 . | a1 . e2 . e2 . | d2 . a2 . a2 . | bb1 . f2 . f2 . | ' +
        'g1 . d2 . d2 . | a1 . e2 . e2 . | bb1 . f2 . f2 . | a1 . e2 . a1 .',
      drums: 'k h h h s h | k h h h s h | k h h h s h | k h s h s s',
    },
    // Every voice of a sting is as long as the part, since a shorter one would repeat.
    // A potion sold: a C7 to F cadence, then one chime per star.
    sold1: { lead: 'g4 bb4 e5 f5 . . c6 . . -', harmony: 'e4 . . a4 . . . . . -', bass: 'c3 . . f2 . . . . . -' },
    sold2: { lead: 'g4 bb4 e5 f5 . . c6 . f6 . . -', harmony: 'e4 . . a4 . . . . . . . -', bass: 'c3 . . f2 . . . . . . . -' },
    sold3: { lead: 'g4 bb4 e5 f5 . . c6 . f6 . a6 . . -', harmony: 'e4 . . a4 . . . . . . . . . -', bass: 'c3 . . f2 . . . . . . . . . -' },
    // Out of moves, or an examination sold with too few stars: a slow fall in D minor.
    fail: { lead: 'a4 . g4 . f4 . e4 . . . d4 . . -', harmony: 'f3 . e3 . d3 . c#3 . . . a2 . . -', bass: 'd2 . . . bb1 . a1 . . . d2 . . -' },
    // A new rank, or a guild examination passed.
    rank: {
      lead: 'c5 f5 a5 c6 . a5 c6 . f6 . . -',
      harmony: 'a4 . c5 f5 . c5 f5 . a5 . . -',
      bass: 'f2 . . . . . c3 . f2 . . -',
      drums: 'k - - - - - k - k - - -',
    },
    // The crown's last order filled: Royal Apothecary.
    crown: {
      lead: 'c5 . f5 . a5 . c6 . . a5 bb5 c6 | d6 . c6 . bb5 . a5 . g5 . f6 . | . . . . . -',
      harmony: 'a4 . c5 . f5 . a5 . . f5 g5 a5 | bb5 . a5 . g5 . f5 . e5 . a5 . | . . . . . -',
      bass: 'f2 . . . f2 . f2 . . . f2 . | bb1 . . . bb1 . c2 . . . f2 . | . . . . . -',
      drums: 'k - h - h - k - h - k k | k - h - h - k - s - k - | - - - - - -',
    },
  },
};

/** The game's own sound effects (`ui('click' | 'coin' | 'refuse')` from the engine covers the rest). */
export const sfx = sounds({
  /** A tile picked: a soft wooden tick. */
  pick: { wave: 'triangle', freq: 1300, to: 900, length: 0.035, volume: 0.3, vary: 0.04 },
  /** A swap that matches: a little two-note slide. */
  swap: { wave: 'triangle', freq: 523, arp: [0, 5], arpStep: 0.045, length: 0.1, volume: 0.28 },
  /** A swap that makes no match slides back: a dull bonk. */
  bonk: { wave: 'triangle', freq: 190, to: 120, length: 0.14, volume: 0.4 },
  /** A match, once per cascade step; its pitch rises with each step. */
  pop: { wave: 'sine', freq: 784, to: 1175, length: 0.11, volume: 0.32, gap: 60, vary: 0.02 },
  /** Gathered ingredients reach the label. */
  tink: { wave: 'sine', freq: 2093, length: 0.07, volume: 0.13, gap: 80, vary: 0.03 },
  /** A Catalyst or Bloom brewed: a shimmering arpeggio. */
  brew: { wave: 'pulse12', freq: 1047, arp: [0, 4, 7, 12], arpStep: 0.045, length: 0.22, volume: 0.2 },
  /** A Catalyst's row or column, or a Bloom's square, goes off: a whoosh. */
  fire: { wave: 'noise', freq: 7000, to: 1800, length: 0.32, attack: 0.04, volume: 0.26, gap: 120 },
  /** Two Blooms swapped together, or any mixed pair of specials: a bigger, deeper burst. */
  burst: { wave: 'noise', freq: 5000, to: 500, length: 0.55, attack: 0.02, volume: 0.36, gap: 200 },
  /** A corked jar opened. */
  cork: { wave: 'sine', freq: 380, to: 1300, length: 0.07, volume: 0.42 },
  /** Resin melted off a tile: a short sizzle. */
  sizzle: { wave: 'noise', freq: 9000, length: 0.24, attack: 0.02, volume: 0.15 },
  /** Mould scrubbed off. */
  scrub: { wave: 'noise', freq: 1600, to: 2800, arp: [0, 7, 0, 7], arpStep: 0.04, length: 0.17, volume: 0.2 },
  /** Mould creeps onto a tile: a squelchy wobble. */
  spread: { wave: 'triangle', freq: 175, to: 120, arp: [0, 3, 0, 3, 0], arpStep: 0.04, length: 0.2, volume: 0.36 },
  /** A town's witch turns a tile into a toad: a low two-note croak. */
  croak: { wave: 'square', freq: 110, to: 90, arp: [0, 5, 0], arpStep: 0.06, length: 0.22, volume: 0.22 },
  /** The forbidden ingredient matched: a move lost. */
  penalty: { wave: 'sawtooth', freq: 140, to: 118, length: 0.22, volume: 0.18, gap: 300 },
  /** No move left, so the board shuffles: a rattling sweep. */
  shuffle: { wave: 'noise', freq: 900, to: 2600, arp: [0, 12, 0, 12, 0, 12, 0, 12], arpStep: 0.04, length: 0.36, volume: 0.22 },
  /** A twin order's customer served: a bell. */
  served: { wave: 'triangle', freq: 1568, length: 0.55, volume: 0.32 },
  /** A royal commission's next stage: two chimes. */
  stage: { wave: 'triangle', freq: 1047, arp: [0, 7], arpStep: 0.13, length: 0.42, volume: 0.32 },
  /** Stir: +3 moves, a swirl. */
  stir: { wave: 'triangle', freq: 330, to: 700, arp: [0, 3, 0, 3, 0, 3], arpStep: 0.045, length: 0.28, volume: 0.3 },
  /** Sift rerolls a row: a rattle. */
  sift: { wave: 'noise', freq: 1300, arp: [0, 12, 0, 12, 0, 12], arpStep: 0.035, length: 0.24, volume: 0.22 },
  /** The Pestle smashes a tile: a thunk. */
  pestle: { wave: 'triangle', freq: 170, to: 55, length: 0.16, volume: 0.55 },
  /** The Funnel swaps two tiles: a glug. */
  funnel: { wave: 'sine', freq: 320, to: 190, arp: [0, 5, 0, 5], arpStep: 0.06, length: 0.26, volume: 0.38 },
  /** A guild seal stamped. */
  stamp: { wave: 'noise', freq: 500, to: 140, length: 0.16, volume: 0.42 },
  /** The idle hint: a very soft twinkle. */
  hint: { wave: 'sine', freq: 2637, arp: [0, 5], arpStep: 0.05, length: 0.14, volume: 0.08, gap: 3000 },
});

export type Sfx = Parameters<typeof sfx>[0];
