import { sounds, type Song } from '../../../shared/audio';

/**
 * Shrine Stack's sound: a slow, mystical tune in D Dorian at 80 BPM (a soft pulse lead with its
 * own echo on the square voice, a triangle drone) and short, soft stone and bell effects. The
 * scene plays them from the events it drains in `show` and from its own buttons; the rules in
 * `game/` stay free of sound.
 */

/** The lead line again, `steps` sixteenths later: the soft echo the harmony voice plays. */
function echo(line: string, steps = 3) {
  const tokens = line.split(/\s+/).filter((token) => token && token !== '|');
  return [...tokens.slice(-steps), ...tokens.slice(0, -steps)].join(' ');
}

const calmLead = [
  // Dm, C, Dm to G, Am
  'd5 . . . f5 . a5 . g5 . f5 . e5 . . .',
  'c5 . e5 . g5 . . . f5 . e5 . c5 . . .',
  'd5 . f5 . a5 . b5 . c6 . b5 . a5 . g5 .',
  'a5 . . . g5 . e5 . f5 . e5 . d5 . . .',
  // Dm, G, C, Dm
  'a5 . . . d6 . c6 . a5 . g5 . f5 . . .',
  'g5 . . . b5 . a5 . g5 . f5 . d5 . . .',
  'e5 . g5 . c6 . . . b5 . a5 . g5 . e5 .',
  'd5 . . . . . . . - - - - - - - -',
].join(' | ');

const gildedLead = [
  // D, G, Em to A, D: the gilded tier turns to D major.
  'd5 . f#5 . a5 . d6 . c#6 . a5 . b5 . a5 .',
  'g5 . b5 . d6 . b5 . a5 . g5 . f#5 . e5 .',
  'e5 . g5 . b5 . e6 . c#6 . . . a5 . . .',
  'd6 . a5 . f#5 . a5 . d5 . . . - - - -',
].join(' | ');

const skyLead = [
  'a5 . . . . . d6 . . . e6 . . . . .',
  'f6 . . . e6 . . . d6 . . . c6 . . .',
  'a5 . . . . . g5 . . . a5 . . . . .',
  'd6 . . . . . . . - - - - - - - -',
].join(' | ');

/** A bar of one note held throughout. */
const held = (note: string) => `${note} ${'. '.repeat(15)}`.trim();

export const SONG: Song = {
  bpm: 80,
  mix: { lead: 0.13, harmony: 0.045, bass: 0.24, drums: 0.18 },
  parts: {
    /** Stacking, tiers 1 to 9 and 11 to 12. */
    calm: {
      lead: calmLead,
      harmony: echo(calmLead),
      bass: [
        'd2 . . . . . . . a2 . . . . . . .',
        'c2 . . . . . . . g2 . . . . . . .',
        'd2 . . . . . . . g2 . . . . . . .',
        'a1 . . . . . . . e2 . . . . . . .',
        'd2 . . . . . . . a2 . . . . . . .',
        'g2 . . . . . . . d2 . . . . . . .',
        'c2 . . . . . . . g2 . . . . . . .',
        'd2 . . . . . . . a1 . . . d2 . . .',
      ].join(' | '),
      drums: 'k - - - h - - - s - - - h - - h',
    },
    /** The patron pick, the breaks between tiers and the end panels: a harp-like loop. */
    break: {
      lead: [
        'd4 f4 a4 d5 f5 d5 a4 f4 d4 f4 a4 d5 e5 d5 a4 f4',
        'g3 b3 d4 g4 b4 g4 d4 b3 g3 b3 d4 g4 a4 g4 d4 b3',
        'f3 a3 c4 f4 a4 f4 c4 a3 f3 a3 c4 f4 g4 f4 c4 a3',
        'a3 c4 e4 a4 c5 a4 e4 c4 a3 c4 e4 a4 b4 a4 e4 c4',
      ].join(' | '),
      harmony: [held('a5'), held('b5'), held('c6'), held('e5')].join(' | '),
      bass: [held('d2'), held('g2'), held('f2'), held('a1')].join(' | '),
    },
    /** The gilded tier: a brighter arrangement with a busier beat. */
    gilded: {
      lead: gildedLead,
      harmony: echo(gildedLead),
      bass: [
        'd2 . . . a2 . . . d3 . . . a2 . . .',
        'g2 . . . d3 . . . g2 . . . b2 . . .',
        'e2 . . . b2 . . . a2 . . . c#3 . . .',
        'd3 . . . a2 . . . d2 . . . a2 . . .',
      ].join(' | '),
      drums: 'k - h - s - h - k - h - s - h h',
    },
    /** The endless sky: high, sparse and airy. */
    sky: {
      lead: skyLead,
      harmony: echo(skyLead, 4),
      bass: [held('d2'), held('c2'), held('g2'), held('a1')].join(' | '),
      drums: '- - h - - - h - - - h - - - h -',
    },
    /** Sting: the shrine is crowned. */
    crown: {
      lead: 'd5 f#5 a5 d6 . . a5 d6 . . . . . . . .',
      harmony: 'a4 d5 f#5 a5 . . f#5 a5 . . . . . . . .',
      bass: 'd3 . . . . . a2 d2 . . . . . . . .',
      drums: 'k - - - s - k k s - - - - - - -',
    },
    /** Sting: the temple has fallen. */
    fall: {
      lead: 'a5 . f5 . e5 . c5 . d5 . . . . . . .',
      harmony: '- - a4 . . . g4 . . . f4 . . . . .',
      bass: 'd3 . . . c3 . . . bb2 . . . a2 . . .',
      drums: 'k - - - - - - - k - - - - - - -',
    },
  },
};

export const sfx = sounds({
  /** A tap lets the stone go. */
  whoosh: { wave: 'noise', freq: 3000, to: 800, length: 0.22, attack: 0.04, volume: 0.18, gap: 120 },
  /** Any stone landing; pitched by its kind. */
  thud: { wave: 'triangle', freq: 140, to: 60, length: 0.14, volume: 0.5, vary: 0.05, gap: 60 },
  /** A piece breaking off. */
  crack: { wave: 'noise', freq: 2500, to: 1200, length: 0.12, volume: 0.22, vary: 0.1, gap: 60 },
  /** A perfect drop; climbs a pentatonic step with each perfect in a row. */
  bell: { wave: 'triangle', freq: 1175, length: 0.4, volume: 0.32, gap: 60 },
  /** A perfect chain grows the stone back. */
  shimmer: { wave: 'pulse12', freq: 880, arp: [0, 4, 7, 12, 16, 19], arpStep: 0.04, length: 0.3, volume: 0.2 },
  /** A balanced tier. */
  chime: { wave: 'triangle', freq: 587, arp: [0, 7, 12], arpStep: 0.1, length: 0.5, volume: 0.36 },
  /** A wobbly tier. */
  meh: { wave: 'square', freq: 330, to: 300, arp: [0, -2], arpStep: 0.12, length: 0.26, volume: 0.18 },
  /** A trial met. */
  sparkle: { wave: 'pulse25', freq: 1568, arp: [0, 5, 12], arpStep: 0.04, length: 0.2, volume: 0.2 },
  /** A trial failed. */
  blip: { wave: 'square', freq: 220, to: 180, length: 0.09, volume: 0.2 },
  /** A leaning tier topples: a rumble under a tumbling cascade. */
  rumble: { wave: 'noise', freq: 120, to: 60, length: 0.8, attack: 0.02, volume: 0.45, gap: 300 },
  tumble: { wave: 'triangle', freq: 300, arp: [0, -3, -5, -8, -12, -15], arpStep: 0.07, length: 0.45, volume: 0.35, gap: 300 },
  /** A missed stone crashing down. */
  crash: { wave: 'noise', freq: 400, to: 100, length: 0.5, volume: 0.4, gap: 200 },
  /** Mason's Grace catches a miss. */
  saved: { wave: 'triangle', freq: 784, arp: [0, 5, 9, 12], arpStep: 0.07, length: 0.4, volume: 0.3 },
  /** The reserve swaps a stone. */
  swish: { wave: 'noise', freq: 6000, to: 2500, length: 0.1, volume: 0.15, gap: 100 },
  /** A patron chosen. */
  gong: { wave: 'triangle', freq: 147, to: 140, length: 1.2, attack: 0.01, volume: 0.55, gap: 500 },
  /** A blessing taken. */
  choir: { wave: 'pulse25', freq: 294, arp: [0, 7, 12, 15, 19], arpStep: 0.05, length: 0.6, attack: 0.03, volume: 0.24 },
  /** A reroll shuffles the cards. */
  shuffle: { wave: 'noise', freq: 5000, arp: [0, -5, 0, -5, 0], arpStep: 0.04, length: 0.22, volume: 0.15, gap: 120 },
  /** A material picked. */
  stone: { wave: 'noise', freq: 1800, to: 900, length: 0.05, volume: 0.28, vary: 0.05 },
  /** The curse taken. */
  pluck: { wave: 'sawtooth', freq: 233, arp: [0, 6], arpStep: 0.06, length: 0.25, volume: 0.18 },
  /** Build on, or on into the sky. */
  rise: { wave: 'noise', freq: 600, to: 4000, length: 0.4, attack: 0.2, volume: 0.18, gap: 200 },
  /** A falling stone nudged aside. */
  nudge: { wave: 'noise', freq: 2200, to: 3600, length: 0.08, volume: 0.16, gap: 80 },
  /** A capstone sets: a deep knock under a rising bright chord. */
  keystone: { wave: 'triangle', freq: 392, arp: [0, 4, 7, 12, 19], arpStep: 0.06, length: 0.55, volume: 0.32, gap: 300 },
  /** A gust picks up around a new stone. */
  gust: { wave: 'noise', freq: 900, to: 1600, length: 0.7, attack: 0.3, volume: 0.12, gap: 500 },
});

export type SoundName = Parameters<typeof sfx>[0];

/** Pentatonic steps for the perfect bell, climbing with the chain. */
const BELL_STEPS = [0, 2, 5, 7, 9, 12];
export const bellPitch = (chain: number) => 2 ** (BELL_STEPS[Math.min(BELL_STEPS.length - 1, Math.max(0, chain - 1))] / 12);
