// Bramblecrest's music: a gentle theme per area, two boss loops and the stings, as chiptune note
// text for shared/audio.ts. Each area's song is its own `Song`, so walking to another area fades
// one out and the next in; the Woods and the Fen share one song (and the two dungeons another), so
// between those the music changes at the next bar.

import type { Part, Song } from '../../../../shared/audio';

/** Writes eighth notes as sixteenth steps: each token is held for two steps. */
function eighths(text: string) {
  return text
    .split(/\s+/)
    .filter((tok) => tok && tok !== '|')
    .map((tok) => (tok === '-' ? '- -' : tok === '.' ? '. .' : `${tok} .`))
    .join(' ');
}

/** Holds a note for a whole number of steps. */
const hold = (note: string, steps: number) => [note, ...Array(steps - 1).fill('.')].join(' ');

/** A sixteenth-note arpeggio over a chord of four notes, one bar long. */
const arp = ([a, b, c, d]: string[]) => [a, b, c, d, c, b, a, b, c, d, c, b, a, b, c, b].join(' ');

/** Pads every voice of a sting to the same length, so none of them repeats. */
function sting(part: Part): Part {
  const steps = (s: string) => s.split(/\s+/).filter((tok) => tok && tok !== '|');
  const n = Math.max(...Object.values(part).map((s) => steps(s!).length));
  const out: Part = {};
  for (const [voice, s] of Object.entries(part) as [keyof Part, string][]) {
    const tokens = steps(s);
    out[voice] = [...tokens, ...Array(n - tokens.length).fill('-')].join(' ');
  }
  return out;
}

// ---------------------------------------------------------------- Mossford

/** Waltz chords, one bar of 3/4 each: the root for the bass and two notes for the square's off-beats. */
const WALTZ: Record<string, [string, string, string]> = {
  F: ['f2', 'a3', 'c4'],
  C: ['c3', 'c4', 'e4'],
  Bb: ['bb2', 'bb3', 'd4'],
  Dm: ['d3', 'a3', 'd4'],
  Gm: ['g2', 'bb3', 'd4'],
  C7: ['c3', 'bb3', 'e4'],
};
const waltzBars = 'F C Bb F Dm Gm C7 F Bb F Gm C F C C7 F'.split(' ').map((c) => WALTZ[c]);

/** Mossford: a lullaby waltz in F major, a triangle lead over a soft square pad and no drums. */
export const VILLAGE: Song = {
  bpm: 120,
  steps: 2,
  waves: { lead: 'triangle', harmony: 'square', bass: 'triangle' },
  mix: { lead: 0.3, harmony: 0.045, bass: 0.22 },
  parts: {
    calm: {
      lead: [
        'f4 . a4 . c5 . | e5 . . . d5 c5 | d5 . . . bb4 . | a4 . . . . . |',
        'a4 . d5 . f5 . | d5 . bb4 . g4 . | e4 . g4 . bb4 . | a4 . . . . - |',
        'd5 . . . f5 . | c5 . . . a4 . | bb4 . a4 . g4 . | e4 . f4 . g4 . |',
        'a4 . c5 . f5 . | e5 . d5 . c5 . | bb4 . a4 . g4 . | f4 . . . . - |',
      ].join(' '),
      harmony: waltzBars.map(([, a, b]) => `- - ${a} . ${b} .`).join(' | '),
      bass: waltzBars.map(([r]) => `${r} . - - - -`).join(' | '),
    },
  },
};

// ---------------------------------------------------------------- Bramble Woods and Glimmer Fen

const CHORDS: Record<string, { arp: string[]; root: string; fifth: string }> = {
  Am: { arp: ['a3', 'c4', 'e4', 'a4'], root: 'a2', fifth: 'e3' },
  D: { arp: ['a3', 'd4', 'f#4', 'a4'], root: 'd2', fifth: 'a2' },
  C: { arp: ['g3', 'c4', 'e4', 'g4'], root: 'c2', fifth: 'g2' },
  G: { arp: ['g3', 'b3', 'd4', 'g4'], root: 'g2', fifth: 'd3' },
  Em: { arp: ['g3', 'b3', 'e4', 'g4'], root: 'e2', fifth: 'b2' },
  Dm: { arp: ['a3', 'd4', 'f4', 'a4'], root: 'd2', fifth: 'a2' },
  F: { arp: ['a3', 'c4', 'f4', 'a4'], root: 'f2', fifth: 'c3' },
};
const arps = (bars: string) => bars.split(' ').map((c) => arp(CHORDS[c].arp)).join(' | ');
const walk = (bars: string) =>
  bars
    .split(' ')
    .map((c) => eighths(`${CHORDS[c].root} . - ${CHORDS[c].root} ${CHORDS[c].fifth} . ${CHORDS[c].root} -`))
    .join(' | ');

/**
 * The wild places: A Dorian in the Woods, a sparser D Dorian in the Fen, a cold E minor on the Peaks
 * and a rolling G Mixolydian on the Coast, pulse arpeggios and a shaker.
 */
export const WILDS: Song = {
  bpm: 84,
  waves: { lead: 'pulse25', harmony: 'pulse12', bass: 'triangle' },
  mix: { lead: 0.13, harmony: 0.05, bass: 0.24, drums: 0.14 },
  parts: {
    woods: {
      lead: eighths(
        [
          'a4 . c5 . e5 . d5 c5 | d5 . . . f#4 . a4 . | g4 . e4 . g4 c5 . . | b4 . . . d5 . b4 . |',
          'a4 . c5 . e5 . a5 . | f#5 . e5 . d5 . a4 . | b4 . g4 . e4 . b4 . | a4 . . . - - - - |',
        ].join(' '),
      ),
      harmony: arps('Am D C G Am D Em Am'),
      bass: walk('Am D C G Am D Em Am'),
      drums: 'k - h h - h h - k - h h - h h -',
    },
    fen: {
      lead: eighths(
        [
          'd5 . . . a4 . . . | b4 . . . d5 . c5 b4 | a4 . . . . . f4 . | e4 . . . . . - - |',
          'd5 . . . f5 . e5 d5 | b4 . . . g4 . a4 b4 | c5 . . . a4 . f4 . | a4 . . . . . - - |',
        ].join(' '),
      ),
      harmony: arps('Dm G Dm Am Dm G F Am'),
      bass: walk('Dm G Dm Am Dm G F Am'),
      drums: 'k - - - h - - - - - h - h - - -',
    },
    peaks: {
      lead: eighths(
        [
          'e5 . . . b4 . . . | g4 . . . a4 . b4 . | c5 . . . . . a4 . | b4 . . . . . - - |',
          'g5 . . . e5 . . . | d5 . . . b4 . g4 . | a4 . . . c5 . b4 . | e4 . . . . . - - |',
        ].join(' '),
      ),
      harmony: arps('Em C G D Em C Am Em'),
      bass: walk('Em C G D Em C Am Em'),
      drums: 'k - - - - - h - k - - - - - h -',
    },
    coast: {
      lead: eighths(
        [
          'g4 . b4 . d5 . . . | c5 . . . e5 . d5 c5 | b4 . . . g4 . a4 . | f4 . . . . . - - |',
          'd5 . . . g5 . f5 . | e5 . c5 . g4 . . . | a4 . b4 . c5 . a4 . | g4 . . . . . - - |',
        ].join(' '),
      ),
      harmony: arps('G C G F G C Am G'),
      bass: walk('G C G F G C Am G'),
      drums: 'k - - h - - h - k - - h - - h -',
    },
  },
};

// ---------------------------------------------------------------- the Sunken Shrine and the Drowned Belfry

const slowArp = (notes: string) => eighths(`${notes} ${notes}`);

/** The dungeons: slow minor loops over a bass drone, with a drip for drums. */
export const DEEP: Song = {
  bpm: 72,
  waves: { lead: 'pulse12', harmony: 'triangle', bass: 'triangle' },
  mix: { lead: 0.12, harmony: 0.1, bass: 0.3, drums: 0.12 },
  parts: {
    shrine: {
      lead: eighths(
        [
          '- - - - a4 . . . | g4 . f4 . e4 . d4 . | - - - - f4 . . . | e4 . . . c#4 . . . |',
          '- - - - d5 . . . | c5 . a4 . bb4 . a4 . | g4 . . . f4 . . . | e4 . . . . . - - |',
        ].join(' '),
      ),
      harmony: [slowArp('d4 f4 a4 f4'), slowArp('d4 f4 a4 f4'), slowArp('d4 f4 bb4 f4'), slowArp('c#4 e4 a4 e4')].join(' | '),
      bass: [hold('d2', 16), hold('d2', 16), hold('bb1', 16), hold('a1', 16)].join(' | '),
      drums: 'k - - - - - - - - - h - - - - -',
    },
    belfry: {
      lead: eighths(
        [
          'b4 . . . . . e5 . | d5 . b4 . g4 . . . | - - c5 . b4 . a4 . | b4 . . . . . - - |',
          'e5 . . . g5 . . . | f#5 . e5 . d5 . b4 . | c5 . . . e5 . . . | d#5 . . . . . - - |',
        ].join(' '),
      ),
      harmony: [slowArp('e4 g4 b4 g4'), slowArp('e4 g4 b4 g4'), slowArp('e4 g4 c5 g4'), slowArp('d#4 f#4 b4 f#4')].join(' | '),
      bass: [hold('e2', 16), hold('e2', 16), hold('c2', 16), hold('b1', 16)].join(' | '),
      drums: 'k - - - - - h - - - - - - - h -',
    },
    caverns: {
      lead: eighths(
        [
          'f#5 . . . . . c#5 . | e5 . d5 . c#5 . . . | - - b4 . c#5 . d5 . | c#5 . . . . . - - |',
          'a5 . . . f#5 . . . | g5 . f#5 . e5 . c#5 . | d5 . . . b4 . . . | c#5 . . . . . - - |',
        ].join(' '),
      ),
      harmony: [slowArp('f#4 a4 c#5 a4'), slowArp('f#4 a4 c#5 a4'), slowArp('d4 f#4 b4 f#4'), slowArp('c#4 f4 g#4 f4')].join(' | '),
      bass: [hold('f#2', 16), hold('f#2', 16), hold('d2', 16), hold('c#2', 16)].join(' | '),
      drums: 'k - - - - - - - h - - - - - - -',
    },
    grotto: {
      lead: eighths(
        [
          'c5 . . . g4 . . . | ab4 . g4 . f4 . . . | - - eb4 . f4 . g4 . | g4 . . . . . - - |',
          'eb5 . . . c5 . . . | d5 . c5 . bb4 . g4 . | ab4 . . . f4 . . . | g4 . . . . . - - |',
        ].join(' '),
      ),
      harmony: [slowArp('c4 eb4 g4 eb4'), slowArp('f4 ab4 c5 ab4'), slowArp('c4 eb4 g4 eb4'), slowArp('b3 d4 g4 d4')].join(' | '),
      bass: [hold('c2', 16), hold('f1', 16), hold('c2', 16), hold('g1', 16)].join(' | '),
      drums: 'k - - - - - - - - - - - h - - -',
    },
  },
};

// ---------------------------------------------------------------- the bosses

const pump = (bars: [string, string][]) => bars.map(([lo, hi]) => eighths(`${lo} ${hi} ${lo} ${hi} ${lo} ${hi} ${lo} ${hi}`)).join(' | ');
const stabs = (notes: string) => notes.split(' ').map((n) => eighths(`- ${n} - ${n} - ${n} - ${n}`)).join(' | ');

/** The four boss fights, at 140 BPM: the Thornmother in A minor, the Bellwraith in E Phrygian, the Gloamwing in B minor, the Brinewyrm in G minor. */
export const BOSS: Song = {
  bpm: 140,
  mix: { lead: 0.14, harmony: 0.06, bass: 0.28, drums: 0.28 },
  parts: {
    thornmother: {
      lead: eighths(
        [
          'e5 . e5 d5 e5 . a4 . | c5 . b4 . a4 . g4 . | a4 . . . f4 . a4 . | b4 . . . d5 . b4 . |',
          'e5 . e5 d5 e5 . a5 . | g5 . e5 . c5 . e5 . | f5 . e5 . d5 . c5 . | b4 . . . g#4 . b4 . |',
        ].join(' '),
      ),
      harmony: stabs('e4 e4 f4 d4 e4 e4 f4 g#4'),
      bass: pump([['a2', 'a3'], ['a2', 'a3'], ['f2', 'f3'], ['g2', 'g3'], ['a2', 'a3'], ['a2', 'a3'], ['f2', 'f3'], ['e2', 'e3']]),
      drums: 'k - h - s - h - k - k - s - h h',
    },
    bellwraith: {
      lead: eighths(
        [
          'e5 . . . f5 . e5 . | b4 . . . g4 . b4 . | c5 . . . a4 . f4 . | e4 . g4 . b4 . e5 . |',
          'g5 . . . e5 . c5 . | a4 . c5 . e5 . a5 . | f5 . e5 . d5 . c5 . | a4 . f4 . a4 . c5 . |',
        ].join(' '),
      ),
      harmony: stabs('g4 g4 a4 g4 g4 e4 a4 a4'),
      bass: pump([['e2', 'e3'], ['e2', 'e3'], ['f2', 'f3'], ['e2', 'e3'], ['c2', 'c3'], ['a1', 'a2'], ['f2', 'f3'], ['f2', 'f3']]),
      drums: 'k - h - s - h k k - h - s - h -',
    },
    gloamwing: {
      lead: eighths(
        [
          'b4 . d5 . f#5 . e5 d5 | c#5 . . . a4 . c#5 . | d5 . . . b4 . g4 . | f#4 . a#4 . c#5 . f#5 . |',
          'b5 . a5 . f#5 . d5 . | e5 . . . c#5 . a4 . | g5 . f#5 . e5 . d5 . | c#5 . . . a#4 . c#5 . |',
        ].join(' '),
      ),
      harmony: stabs('f#4 e4 d4 c#4 f#4 e4 d4 c#4'),
      bass: pump([['b1', 'b2'], ['a1', 'a2'], ['g1', 'g2'], ['f#1', 'f#2'], ['b1', 'b2'], ['a1', 'a2'], ['e2', 'e3'], ['f#1', 'f#2']]),
      drums: 'k - h k s - h - k - h - s - s s',
    },
    brinewyrm: {
      lead: eighths(
        [
          'g4 . bb4 . d5 . c5 bb4 | a4 . . . f#4 . a4 . | bb4 . . . g4 . eb4 . | d4 . f#4 . a4 . d5 . |',
          'g5 . f5 . d5 . bb4 . | c5 . . . eb5 . c5 . | d5 . c5 . bb4 . a4 . | g4 . . . f#4 . a4 . |',
        ].join(' '),
      ),
      harmony: stabs('d4 d4 eb4 d4 d4 eb4 d4 d4'),
      bass: pump([['g1', 'g2'], ['d2', 'd3'], ['eb2', 'eb3'], ['d2', 'd3'], ['g1', 'g2'], ['c2', 'c3'], ['d2', 'd3'], ['d2', 'd3']]),
      drums: 'k - h - s k h - k - h - s - h h',
    },
  },
};

// ---------------------------------------------------------------- stings

/** Played once over the music, which ducks: an item, a boss beaten, a fall and the chapter endings. */
export const STINGS: Song = {
  bpm: 120,
  mix: { lead: 0.16, harmony: 0.08, bass: 0.24, drums: 0.24 },
  parts: {
    item: sting({
      lead: 'c5 . e5 . g5 . c6 . . . g5 . c6 . . . . .',
      harmony: 'e4 . g4 . c5 . e5 . . . e5 . e5 . . . . .',
      bass: 'c3 . . . . . . . g2 . . . c3 . . . . .',
      drums: 'k - - - - - - - k - - - s - - -',
    }),
    victory: sting({
      lead: 'g4 . c5 . e5 . g5 . . . f5 . e5 . f5 . g5 . . . c6 . . . . . . .',
      harmony: 'e4 . e4 . g4 . c5 . . . a4 . g4 . a4 . b4 . . . e5 . . . . . . .',
      bass: 'c3 . . . c3 . . . f2 . . . f2 . . . g2 . . . . . . . c3 . . . . . . .',
      drums: 'k - h - k - h - k - h - s - h - k - h - s - s s k - - - - - - -',
    }),
    fall: sting({
      lead: 'e5 . d5 . c5 . . . b4 . a4 . . . g#4 . . . a4 . . . . .',
      harmony: 'c5 . b4 . a4 . . . g#4 . e4 . . . d4 . . . c4 . . . . .',
      bass: 'a2 . . . . . . . f2 . . . . . . . e2 . . . a1 . . . . .',
    }),
    // The chapter's end card, by how many moonstones were found.
    endAll: sting({
      lead: 'c5 . e5 . g5 . c6 . b5 . g5 . a5 . f5 . g5 . e5 . f5 . d5 . e5 . g5 . c6 . . . . . . . . . . .',
      harmony: 'e4 . g4 . c5 . e5 . d5 . b4 . c5 . a4 . b4 . g4 . a4 . f4 . g4 . b4 . e5 . . . . . . . . . . .',
      bass: 'c3 . . . . . . . g2 . . . . . . . f2 . . . . . . . g2 . . . . . . . c3 . . . . . . . . . . .',
      drums: 'k - h - s - h - k - h - s - h - k - h - s - h - k - h - s - s s k - - - - - - - - - - -',
    }),
    endSome: sting({
      lead: 'a4 . c5 . f5 . . . e5 . c5 . d5 . . . c5 . a4 . bb4 . g4 . a4 . . . f4 . . . . . . .',
      harmony: 'f4 . a4 . c5 . . . c5 . a4 . bb4 . . . a4 . f4 . g4 . e4 . f4 . . . c4 . . . . . . .',
      bass: 'f2 . . . . . . . c3 . . . bb2 . . . f2 . . . c3 . . . f2 . . . . . . . . . . .',
      drums: 'k - - - h - - - k - - - h - - - k - - - h - - - k - - - - - - - - - - -',
    }),
    endFew: sting({
      lead: 'e5 . . . d5 . c5 . b4 . . . a4 . . . c5 . b4 . a4 . g#4 . a4 . . . . . . . . . . .',
      harmony: 'c5 . . . a4 . a4 . g#4 . . . e4 . . . e4 . d4 . c4 . b3 . c4 . . . . . . . . . . .',
      bass: 'a2 . . . . . . . e2 . . . . . . . f2 . . . . . . . a1 . . . . . . . . . . .',
    }),
  },
};
