// Golem Garden's sound: its effects table and its music, all synthesized by shared/audio.ts. The
// scene plays them (`GameScene`); the rules in game/ stay free of sound.
import { sounds, type Song } from '../../../shared/audio';

/** The garden's sound effects; `sfx(name)` plays one. */
export const sfx = sounds({
  /** A seed card or the hedge strip picked: a soft clay squish. */
  select: { wave: 'triangle', freq: 520, to: 300, length: 0.06, volume: 0.3, vary: 0.04 },
  /** A golem seed planted: a squelchy plop. */
  plant: { wave: 'triangle', freq: 380, to: 110, length: 0.14, volume: 0.45, vary: 0.05 },
  /** A hedge planted, a leaf regrown: leaves rustling. */
  rustle: { wave: 'noise', freq: 3200, to: 1800, length: 0.16, attack: 0.03, volume: 0.22, gap: 80 },
  /** A seed grown into a golem: a rising boing. */
  grown: { wave: 'triangle', freq: 220, to: 660, length: 0.22, volume: 0.35, vary: 0.05, gap: 100 },
  /** A golem raised a level; played higher for each level. */
  raise: { wave: 'square', freq: 523, arp: [0, 4, 7], arpStep: 0.05, length: 0.2, volume: 0.22 },
  /** A level-3 form picked: a bigger arpeggio. */
  form: { wave: 'square', freq: 523, arp: [0, 4, 7, 12, 16], arpStep: 0.05, length: 0.34, volume: 0.24 },
  /** Aim changed: a light tick. */
  aim: { wave: 'square', freq: 1400, length: 0.03, volume: 0.18 },
  /** A golem moved: a slide. */
  move: { wave: 'triangle', freq: 300, to: 620, length: 0.15, volume: 0.35 },
  /** A golem uprooted: a pop (the shared coin follows). */
  uproot: { wave: 'sine', freq: 640, to: 180, length: 0.09, volume: 0.45 },
  /** Throws, at most one per golem kind every 70ms: a pebble's thup, moss's wet splat, a thorn's scratch. */
  pebble: { wave: 'triangle', freq: 190, to: 85, length: 0.07, volume: 0.32, gap: 70, vary: 0.08 },
  moss: { wave: 'noise', freq: 1100, to: 300, length: 0.1, volume: 0.2, gap: 70, vary: 0.08 },
  thorn: { wave: 'pulse12', freq: 1600, to: 2500, length: 0.05, volume: 0.13, gap: 70, vary: 0.06 },
  /** A fungus golem's spore puff, and a bell golem's ring (a bell: a high sine with a fifth over it). */
  fungus: { wave: 'noise', freq: 600, to: 1400, length: 0.14, attack: 0.03, volume: 0.16, gap: 70, vary: 0.08 },
  bell: { wave: 'sine', freq: 1568, arp: [0, 7], arpStep: 0.02, length: 0.5, volume: 0.2, gap: 120, vary: 0.02 },
  /** An armoured snail hit: a small metal clink. */
  clink: { wave: 'square', freq: 2400, length: 0.04, volume: 0.13, gap: 90, vary: 0.1 },
  /** A pest squashed: a squish, then the sap's bright blip. */
  squash: { wave: 'noise', freq: 700, to: 180, length: 0.1, volume: 0.28, gap: 60, vary: 0.1 },
  sap: { wave: 'square', freq: 1320, arp: [0, 7], arpStep: 0.04, length: 0.08, volume: 0.15, gap: 60, vary: 0.03 },
  /** Pests coming in: a crow's caw, a mole digging, the Queen Slug's groan. */
  caw: { wave: 'sawtooth', freq: 900, to: 620, arp: [0, -3], arpStep: 0.09, length: 0.18, volume: 0.16, gap: 300, vary: 0.05 },
  dig: { wave: 'noise', freq: 140, to: 60, length: 0.3, attack: 0.04, volume: 0.35, gap: 400 },
  groan: { wave: 'sawtooth', freq: 110, to: 70, length: 0.65, attack: 0.08, volume: 0.25, gap: 1000 },
  /** A hedge chewed through: a crunchy snap. */
  snap: { wave: 'noise', freq: 2600, to: 600, length: 0.15, volume: 0.32, gap: 100 },
  /** A pest bites the Heartwood: a wooden thud. */
  bite: { wave: 'triangle', freq: 160, to: 55, length: 0.16, volume: 0.5, gap: 120 },
  /** A wave sent in: a little horn. */
  horn: { wave: 'pulse25', freq: 392, arp: [0, 0, 7, 12], arpStep: 0.08, length: 0.36, volume: 0.24 },
  /** A wave called early: a whistle. */
  whistle: { wave: 'sine', freq: 1200, to: 1900, arp: [0, 0, 5], arpStep: 0.06, length: 0.2, volume: 0.28 },
  /** A wave cleared: a jingle. */
  cleared: { wave: 'pulse25', freq: 784, arp: [0, 4, 7, 12], arpStep: 0.06, length: 0.32, volume: 0.22 },
  /** A bud opens on the Heartwood; played higher for each bud. */
  bud: { wave: 'sine', freq: 1175, length: 0.4, volume: 0.3 },
  /** The Heartwood in full bloom: a full chord. */
  bloom: { wave: 'sine', freq: 784, arp: [0, 4, 7, 12, 16, 19], arpStep: 0.035, length: 0.7, volume: 0.32 },
  /** A leaf regrown: a chime over the rustle. */
  chime: { wave: 'triangle', freq: 880, arp: [0, 5, 9], arpStep: 0.07, length: 0.3, volume: 0.3 },
  /** A boon taken: a sparkle. */
  boon: { wave: 'square', freq: 1760, arp: [0, 7, 12, 19], arpStep: 0.04, length: 0.25, volume: 0.16 },
});

export type Sfx = Parameters<typeof sfx>[0];

/** Holds a note for `steps` steps: `held('g4', 4)` is `g4 . . .`. */
const held = (note: string, steps: number) => [note, ...Array(steps - 1).fill('.')].join(' ');

/** Between waves: a bouncy pastoral tune in G major pentatonic, at 96 BPM. Chords G, Em, C, D. */
export const CALM: Song = {
  bpm: 96,
  mix: { lead: 0.14, harmony: 0.05, bass: 0.24, drums: 0.18 },
  parts: {
    calm: {
      lead: [
        'g4 . b4 . d5 . . b4 | a4 . g4 . e4 . . .',
        'd4 . e4 . g4 . a4 . | b4 . . . a4 . - -',
        'g4 . b4 . d5 . e5 . | d5 . b4 . a4 . g4 .',
        'e4 . g4 . a4 . b4 a4 | g4 . . . - - - -',
        'b4 . d5 . e5 . . d5 | b4 . a4 . g4 . . .',
        'a4 . b4 . d5 . b4 . | a4 . g4 . e4 . . .',
        'd4 . g4 . a4 . b4 . | d5 . e5 . d5 . b4 .',
        'a4 . . . g4 . . . | g4 . . . - - - -',
      ].join(' | '),
      harmony: [held('b3', 8), held('d4', 8), held('g3', 8), held('b3', 8), held('e4', 8), held('c4', 8), held('a3', 8), held('d4', 8)].join(' '),
      bass: [
        'g2 . . . d3 . . . g2 . . . d3 . b2 .',
        'e2 . . . b2 . . . e2 . . . b2 . g2 .',
        'c3 . . . g2 . . . c3 . . . g2 . e2 .',
        'd2 . . . a2 . . . d2 . . . a2 . f#2 .',
      ].join(' | '),
      drums: 'k - h - h - h - s - h - h - h h',
    },
  },
};

/** While pests come: the same tune's world at 132 BPM, and a minor turn for the Queen Slug's waves. */
export const WAVES: Song = {
  bpm: 132,
  mix: { lead: 0.14, harmony: 0.06, bass: 0.26, drums: 0.26 },
  parts: {
    battle: {
      lead: [
        'g4 b4 d5 b4 g4 b4 d5 e5 | d5 . b4 . a4 . g4 .',
        'e4 g4 a4 g4 e4 g4 a4 b4 | a4 . g4 . e4 . d4 .',
        'g4 b4 d5 b4 g4 b4 d5 g5 | e5 . d5 . b4 . d5 .',
        'e5 . d5 . b4 . a4 . | g4 . . . g4 . - -',
      ].join(' | '),
      harmony: [
        '- - d4 - - - d4 - - - d4 - - - d4 -',
        '- - b3 - - - b3 - - - b3 - - - b3 -',
        '- - e4 - - - e4 - - - e4 - - - e4 -',
        '- - d4 - - - d4 - - - f#4 - - - f#4 -',
      ].join(' | '),
      bass: [
        'g2 . g3 . g2 . g3 . g2 . g3 . d3 . g3 .',
        'e2 . e3 . e2 . e3 . e2 . e3 . b2 . e3 .',
        'c3 . c3 . g2 . c3 . c3 . c3 . g2 . c3 .',
        'd2 . d3 . d2 . d3 . a2 . d3 . f#2 . a2 .',
      ].join(' | '),
      drums: 'k - h - s - h - k - k - s - h h',
    },
    boss: {
      lead: [
        'e4 . g4 . b4 . a4 . | g4 . e4 . d4 . e4 .',
        'e4 . g4 . a4 . b4 . | d5 . b4 . a4 . . .',
        'b4 . d5 . e5 . d5 . | b4 . a4 . g4 . e4 .',
        'd4 . e4 . g4 . e4 . | e4 . . . - - - -',
      ].join(' | '),
      harmony: [held('b3', 8), held('g3', 8), held('b3', 8), held('g3', 8), held('e4', 8), held('g3', 8), held('f#3', 8), held('a3', 8)].join(' '),
      bass: [
        'e2 . e3 . e2 . e3 . e2 . e3 . e2 . d3 .',
        'e2 . e3 . e2 . e3 . e2 . e3 . e2 . g2 .',
        'c2 . c3 . c2 . c3 . c2 . c3 . c2 . b2 .',
        'd2 . d3 . d2 . d3 . b1 . b2 . b1 . d2 .',
      ].join(' | '),
      drums: 'k - h k s - h - k - h k s - s h',
    },
  },
};

/** One rising note per harvest star, then a held G chord. */
function harvest(stars: number) {
  const notes = ['b4', 'd5', 'e5'].slice(0, stars);
  const lead = [...notes.map((n) => held(n, 4)), held('g5', 12)].join(' ');
  return {
    lead,
    harmony: [held('d4', stars * 4), held('b4', 12)].join(' '),
    bass: [held('g2', stars * 4), held('g2', 12)].join(' '),
    drums: [...Array(stars).fill('k - - -'), 's - - - k - - - s - - -'].join(' '),
  };
}

/** The stings: a harvest win (`harvest1` to `harvest3`, by stars) and the Heartwood falling (`lose`). */
export const STINGS: Song = {
  bpm: 120,
  mix: { lead: 0.18, harmony: 0.07, bass: 0.26, drums: 0.24 },
  parts: {
    harvest1: harvest(1),
    harvest2: harvest(2),
    harvest3: harvest(3),
    lose: {
      lead: 'd5 . . . b4 . . . a4 . . . g4 . e4 . | e4 . . . . . . . - - - -',
      harmony: `${held('g3', 16)} ${held('e3', 8)} - - - -`,
      bass: `g2 . . . . . . . c2 . . . . . . . | ${held('e2', 8)} - - - -`,
      drums: 'k - - - - - - - k - - - - - - - | s - - - - - - - - - - -',
    },
  },
};
