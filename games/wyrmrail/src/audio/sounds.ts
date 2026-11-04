import { sounds, type Song } from '../../../../shared/audio';

/**
 * Wyrmrail's sound effects, synthesized by `shared/audio.ts`. The scene plays them: the player's
 * own taps right where it calls the sim, and what the sim did in a frame through `GameSounds`.
 */
export const sfx = sounds({
  /** A piece of track laid: a wooden tok, pitched by terrain and rising along a drag. */
  tok: { wave: 'triangle', freq: 760, to: 240, length: 0.06, volume: 0.45, gap: 30, vary: 0.03 },
  /** Track taken up: the tok played backwards (with `ui('coin')` for the refund). */
  untok: { wave: 'triangle', freq: 240, to: 720, length: 0.08, volume: 0.4, gap: 30, vary: 0.03 },
  /** A switch thrown by a tap: click-clack. */
  switch: { wave: 'pulse12', freq: 1400, to: 900, arp: [0, -5], arpStep: 0.04, length: 0.09, volume: 0.25, gap: 60 },
  /** A wyrm stops on a junction to throw its switch itself: a slower clack. */
  switchStop: { wave: 'pulse12', freq: 700, to: 500, arp: [0, -7], arpStep: 0.1, length: 0.22, volume: 0.22, gap: 300 },
  /** An order card tapped: the wyrm is sent. */
  send: { wave: 'pulse25', freq: 520, to: 1040, length: 0.1, volume: 0.25, gap: 60 },
  /** A new order on the board: a two-note bell. */
  order: { wave: 'sine', freq: 1568, arp: [0, -4], arpStep: 0.12, length: 0.32, volume: 0.28, gap: 200 },
  /** Goods loaded into a wagon. */
  load: { wave: 'square', freq: 523, arp: [0, 4, 7], arpStep: 0.05, length: 0.18, volume: 0.2, gap: 100 },
  /** Goods delivered in time: a coin jingle. */
  deliver: { wave: 'pulse25', freq: 988, arp: [0, 5, 12], arpStep: 0.055, length: 0.26, volume: 0.28, gap: 100 },
  /** A workshop sends its better goods on: an anvil ting. */
  workshop: { wave: 'sine', freq: 2093, to: 2030, attack: 0.002, length: 0.4, volume: 0.25, gap: 150 },
  /** A wyrm eats at the Roost: munching chomps. */
  munch: { wave: 'noise', freq: 900, to: 500, arp: [0, -12, 0, -12], arpStep: 0.07, length: 0.28, volume: 0.28, gap: 300 },
  /** An order out of time: a falling wah-wah. */
  late: { wave: 'pulse25', freq: 330, to: 230, arp: [0, -1, -3], arpStep: 0.15, length: 0.5, volume: 0.25, gap: 300 },
  /** A village sours (forgotten too long). */
  sour: { wave: 'square', freq: 300, to: 250, arp: [0, 1], arpStep: 0.06, length: 0.14, volume: 0.18, gap: 200 },
  /** A village loses faith in the line, and a heart goes: a deep thud. */
  faith: { wave: 'triangle', freq: 130, to: 45, length: 0.32, volume: 0.55, gap: 300 },
  /** A washout or a rockfall warned: two alarm pings. */
  warn: { wave: 'pulse25', freq: 1320, arp: [0, -12, 0, -12], arpStep: 0.08, length: 0.32, volume: 0.18, gap: 500 },
  /** A washout takes a bridge: a splash. */
  splash: { wave: 'noise', freq: 5000, to: 700, attack: 0.01, length: 0.5, volume: 0.28, gap: 300 },
  /** A rockfall takes track: a rumble. */
  rumble: { wave: 'noise', freq: 320, to: 70, attack: 0.02, length: 0.65, volume: 0.42, gap: 300 },
  /** A new round, a village joining the line: a rising fanfare. */
  round: { wave: 'square', freq: 392, arp: [0, 4, 7, 12], arpStep: 0.08, length: 0.42, volume: 0.22, gap: 500 },
  /** The charter cards shown: a parchment swish. */
  charter: { wave: 'noise', freq: 6000, to: 2500, attack: 0.08, length: 0.26, volume: 0.13, gap: 300 },
  /** A charter picked: a stamp. */
  stamp: { wave: 'noise', freq: 900, to: 150, attack: 0.002, length: 0.13, volume: 0.45, gap: 200 },
  /** An upgrade or a depot bought: ka-ching. */
  buy: { wave: 'sine', freq: 1047, arp: [0, 7, 12], arpStep: 0.045, length: 0.32, volume: 0.3, gap: 120 },
  /** The second wyrm wakes: a dragon's roar. */
  roar: { wave: 'sawtooth', freq: 170, to: 65, attack: 0.06, length: 0.75, volume: 0.24, gap: 500 },
  /** A courier call sent: a whistle. */
  courier: { wave: 'sine', freq: 1400, to: 2000, attack: 0.02, length: 0.26, volume: 0.24, gap: 150 },
  /** The courier's gifts delivered: a happy chime. */
  gifts: { wave: 'sine', freq: 1047, arp: [0, 4, 7, 12], arpStep: 0.06, length: 0.36, volume: 0.25, gap: 200 },
  /** A lamp hung on the track: a soft glassy ting. */
  lamp: { wave: 'sine', freq: 1760, to: 1700, attack: 0.004, length: 0.22, volume: 0.2, gap: 80 },
  /** A village grows into a town: a bright peal of bells. */
  grow: { wave: 'sine', freq: 784, arp: [0, 7, 12, 16, 19], arpStep: 0.07, length: 0.55, volume: 0.26, gap: 500 },
  /** The rival takes an order off the board: a low, smug horn. */
  rival: { wave: 'sawtooth', freq: 220, to: 180, arp: [0, -5], arpStep: 0.14, length: 0.34, volume: 0.16, gap: 300 },
  /** The wyrm was sent before the rival could take the order: a quick whoosh up. */
  beatRival: { wave: 'pulse25', freq: 660, to: 1320, length: 0.12, volume: 0.2, gap: 200 },
});

export type Sfx = Parameters<typeof sfx>[0];

/** One bar of bass under a chord: root, fifth, root, fifth and third, in quarters and eighths. */
const walk = (root: string, fifth: string, third: string) => `${root} . . . ${fifth} . . . ${root} . . . ${fifth} . ${third} .`;
const G = walk('g2', 'd3', 'b2');
const C = walk('c3', 'g2', 'e2');
const D = walk('d2', 'a2', 'f#2');
const Em = walk('e2', 'b2', 'g2');
/** Driving eighths for the busy part. */
const drive = (root: string, up: string, fifth: string) => `${root} . ${up} . ${root} . ${up} . ${root} . ${up} . ${fifth} . ${up} .`;
/** An arpeggio layer in eighths, over one chord. */
const arp = (a: string, b: string, c: string) => `${a} - ${b} - ${c} - ${b} - ${a} - ${b} - ${c} - ${b} -`;

/**
 * Wyrmrail's song: fiddle-like folk in G major pentatonic at 100 BPM, a pulse lead over a triangle
 * bass and brushed drums.
 *
 * - `calm`: the round being played.
 * - `travel`: the same tune with an arpeggio layer, once the round's charter is picked.
 * - `charter`: a calmer loop while the charter cards wait for a pick.
 * - `busy`: running sixteenths while an order runs low or a hazard is warned.
 * - `festival`: a festive loop for the last round.
 * - Stings: `gold`, `silver` and `bronze` medal fanfares, and `lose`, a minor game-over sting.
 */
export const SONG: Song = {
  bpm: 100,
  mix: { lead: 0.15, harmony: 0.06, bass: 0.26, drums: 0.2 },
  parts: {
    calm: {
      lead:
        'g4 . b4 . d5 . . e5 d5 . b4 . a4 . g4 . | a4 . b4 . d5 . e5 . g5 . . . e5 . d5 . | ' +
        'e5 . d5 . b4 . d5 . a4 . g4 . e4 . g4 . | a4 . . . b4 . a4 . g4 . . . - - - - | ' +
        'd5 . e5 . g5 . e5 . d5 . b4 . d5 . . . | e5 . d5 . b4 . a4 . b4 . . . - - - - | ' +
        'g4 . a4 . b4 . d5 . e5 . d5 . b4 . a4 . | g4 . . . d4 . . . g4 . . . - - - -',
      bass: [G, G, Em, D, G, C, Em, `d2 . . . a2 . . . g2 . . . d3 . . .`].join(' | '),
      drums: 'k - h - s - h h k - h - s - h -',
    },
    travel: {
      lead:
        'g4 . b4 . d5 . . e5 d5 . b4 . a4 . g4 . | a4 . b4 . d5 . e5 . g5 . . . e5 . d5 . | ' +
        'e5 . d5 . b4 . d5 . a4 . g4 . e4 . g4 . | a4 . . . b4 . a4 . g4 . . . - - - - | ' +
        'd5 . e5 . g5 . e5 . d5 . b4 . d5 . . . | e5 . d5 . b4 . a4 . b4 . . . - - - - | ' +
        'g4 . a4 . b4 . d5 . e5 . d5 . b4 . a4 . | g4 . . . d4 . . . g4 . . . - - - -',
      harmony: [
        arp('g4', 'b4', 'd5'),
        arp('g4', 'b4', 'd5'),
        arp('e4', 'g4', 'b4'),
        arp('d4', 'f#4', 'a4'),
        arp('g4', 'b4', 'd5'),
        arp('e4', 'g4', 'c5'),
        arp('e4', 'g4', 'b4'),
        arp('d4', 'f#4', 'a4'),
      ].join(' | '),
      bass: [G, G, Em, D, G, C, Em, `d2 . . . a2 . . . g2 . . . d3 . . .`].join(' | '),
      drums: 'k - h - s - h h k - h - s - h -',
    },
    charter: {
      lead:
        'd5 . . . . . . . b4 . . . . . . . | e5 . . . d5 . . . b4 . . . . . . . | ' +
        'a4 . . . . . . . g4 . . . . . . . | a4 . . . b4 . . . d4 . . . . . . .',
      bass:
        'g2 . . . . . . . d3 . . . . . . . | c3 . . . . . . . g2 . . . . . . . | ' +
        'e2 . . . . . . . b2 . . . . . . . | d2 . . . . . . . a2 . . . . . . .',
      drums: 'k - - - - - - - h - - - - - - -',
    },
    busy: {
      lead:
        'g4 b4 d5 b4 g4 b4 d5 e5 d5 b4 a4 b4 d5 . . . | e5 d5 b4 d5 e5 g5 e5 d5 b4 a4 g4 a4 b4 . . . | ' +
        'd5 e5 g5 e5 d5 b4 d5 e5 g5 a5 g5 e5 d5 . . . | e5 d5 b4 a4 g4 a4 b4 d5 a4 . . . g4 . . .',
      bass: [drive('g2', 'g3', 'd3'), drive('e2', 'e3', 'b2'), drive('c2', 'c3', 'g2'), drive('d2', 'd3', 'a2')].join(' | '),
      drums: 'k - h h s - h h k k h h s - h s',
    },
    festival: {
      lead:
        'd5 . g5 . g5 . a5 . b5 . g5 . d5 . . . | e5 . c6 . b5 . a5 . g5 . . . f#5 . . . | ' +
        'g5 . b5 . d6 . b5 . a5 . g5 . e5 . g5 . | f#5 . a5 . d5 . f#5 . g5 . . . - - - -',
      harmony:
        '- - b4 - - - d5 - - - b4 - - - d5 - | - - e4 - - - g4 - - - f#4 - - - a4 - | ' +
        '- - b4 - - - d5 - - - g4 - - - b4 - | - - f#4 - - - a4 - - - b4 - - - d5 -',
      bass: [G, `c2 . . . g2 . . . d2 . . . a2 . f#2 .`, G, `d2 . . . a2 . . . g2 . . . d2 . b2 .`].join(' | '),
      drums: 'k - h - s - h - k - k - s - h h',
    },
    gold: {
      lead: 'd5 . g5 . b5 . d6 . . . b5 . d6 . . . | . . . . . . . .',
      harmony: 'b4 . d5 . g5 . b5 . . . g5 . b5 . . . | . . . . . . . .',
      bass: 'g2 . . . d3 . . . g2 . . . d3 . . . | g2 . . . . . . .',
      drums: 'k - - - k - - - k - s - k - s s | k - - - - - - -',
    },
    silver: {
      lead: 'g4 . b4 . d5 . . . b4 . d5 . g5 . . . | . . . . . . . .',
      harmony: 'd4 . g4 . b4 . . . g4 . b4 . d5 . . . | . . . . . . . .',
      bass: 'g2 . . . . . . . d3 . . . g2 . . . | . . . . . . . .',
      drums: 'k - - - s - - - k - - - s - h - | k - - - - - - -',
    },
    bronze: {
      lead: 'g4 . a4 . b4 . . . d5 . . . . . . .',
      bass: 'g2 . . . . . . . d2 . . . g2 . . .',
      drums: 'k - - - h - - - k - - - s - - -',
    },
    lose: {
      lead: 'b4 . a4 . g4 . . . f#4 . e4 . . . . . | d#4 . . . e4 . . . . . . .',
      bass: 'e3 . . . . . . . c3 . . . . . . . | b2 . . . e2 . . . . . . .',
      drums: 'k - - - - - - - k - - - - - - - | k - - - k - - - - - - -',
    },
  },
};
