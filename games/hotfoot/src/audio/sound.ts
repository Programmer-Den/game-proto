import { sounds, type Song } from '../../../../shared/audio';

/**
 * Hotfoot's sound table: short synthesized effects for the knight's run, played by `SoundCues`
 * (`cues.ts`) from what changed in the run each frame, and by `GameScene` for its buttons.
 */
export const sfx = sounds({
  /** A jump: a rising boing; an air jump plays it higher (`pitch`). */
  jump: { wave: 'square', freq: 300, to: 620, length: 0.13, volume: 0.24, gap: 60, vary: 0.03 },
  /** A slide along the road: a short scrape of noise. */
  slide: { wave: 'noise', freq: 2600, to: 900, length: 0.24, volume: 0.16, gap: 140 },
  /** An air drop: a fast down-sweep. */
  drop: { wave: 'square', freq: 720, to: 180, length: 0.11, volume: 0.2, gap: 120 },
  /** Feet back on the ground. */
  land: { wave: 'triangle', freq: 150, to: 55, length: 0.08, volume: 0.4, gap: 90 },
  /** A landing that skids on ice. */
  skid: { wave: 'noise', freq: 7000, to: 2400, length: 0.22, volume: 0.13, gap: 160 },
  /** A coin taken; its pitch climbs the scale with the streak. */
  coin: { wave: 'pulse25', freq: 988, arp: [0, 7], arpStep: 0.04, length: 0.09, volume: 0.17, gap: 35 },
  /** The streak's multiplier goes up. */
  streak: { wave: 'pulse25', freq: 784, arp: [0, 4, 7, 12], arpStep: 0.05, length: 0.26, volume: 0.24, gap: 200 },
  /** A goblin or bat stomped: a squishy pop and a bounce. */
  stomp: { wave: 'square', freq: 180, to: 760, length: 0.14, volume: 0.26, gap: 80, vary: 0.05 },
  /** A heart lost: a crunch with a falling tone. */
  hit: { wave: 'sawtooth', freq: 320, to: 70, length: 0.32, volume: 0.3, gap: 250 },
  /** A hit blocked by the Aegis: a clang. */
  block: { wave: 'pulse12', freq: 1320, to: 1180, arp: [0, 7], arpStep: 0.03, length: 0.28, volume: 0.22, gap: 200 },
  /** A fire vent about to burn: a soft crackle. */
  crackle: { wave: 'noise', freq: 1800, length: 0.18, volume: 0.09, gap: 300 },
  /** A fire vent flaring up: a whoosh. */
  flare: { wave: 'noise', freq: 600, to: 1600, length: 0.32, attack: 0.06, volume: 0.13, gap: 300 },
  /** A shrine's heart: a chime. */
  heal: { wave: 'triangle', freq: 659, arp: [0, 4, 7, 12], arpStep: 0.07, length: 0.42, volume: 0.36, gap: 300 },
  /** The herald's dare met: a little fanfare. */
  dare: { wave: 'pulse25', freq: 587, arp: [0, 4, 7, 12, 7, 12], arpStep: 0.07, length: 0.5, volume: 0.24, gap: 300 },
  /** A boss throws an axe or a tail lash: a whoosh. */
  throw: { wave: 'noise', freq: 1500, to: 500, length: 0.24, attack: 0.04, volume: 0.13, gap: 200 },
  /** A boss rolls a barrel or fire along the road: a rumble. */
  roll: { wave: 'noise', freq: 140, to: 70, length: 0.42, attack: 0.03, volume: 0.24, gap: 200 },
  /** A boss stomped: a heavy thump. */
  bossHit: { wave: 'triangle', freq: 130, to: 40, length: 0.3, volume: 0.55, gap: 150 },
  /** The Gatekeeper beaten: a victory flourish. */
  bossDown: { wave: 'square', freq: 392, arp: [0, 4, 7, 12, 16, 19], arpStep: 0.08, length: 0.62, volume: 0.22, gap: 500 },
  /** The rockfall catches the knight: a rumbling crash. */
  rock: { wave: 'noise', freq: 220, to: 45, length: 0.55, volume: 0.32, gap: 400 },
  /** Arriving at a checkpoint's banner. */
  checkpoint: { wave: 'triangle', freq: 784, arp: [0, 5, 9, 12], arpStep: 0.07, length: 0.45, volume: 0.36, gap: 400 },
  /** A boon or a road taken. */
  pick: { wave: 'square', freq: 660, arp: [0, 7], arpStep: 0.06, length: 0.14, volume: 0.22, gap: 120 },
  /** A boon pair completed: a magic arpeggio. */
  pair: { wave: 'pulse25', freq: 880, arp: [0, 4, 7, 11, 14, 19], arpStep: 0.05, length: 0.5, volume: 0.2, gap: 400 },
  /** A new stage's title: a heraldic horn call. */
  horn: { wave: 'square', freq: 293.66, arp: [0, 7, 12, 7, 12], arpStep: 0.11, length: 0.6, attack: 0.02, volume: 0.2, gap: 600 },
  /** A gust on the Sky Road starts blowing at the knight's back: a long airy whoosh. */
  gust: { wave: 'noise', freq: 500, to: 2200, length: 0.7, attack: 0.25, volume: 0.12, gap: 1200 },
  /** A cloud on the Sky Road gives way and starts to fall: a soft sinking puff. */
  sink: { wave: 'triangle', freq: 520, to: 160, length: 0.35, volume: 0.22, gap: 300 },
  /** Run again: a whoosh up. */
  again: { wave: 'noise', freq: 400, to: 2400, length: 0.26, attack: 0.05, volume: 0.13, gap: 300 },
});

export type SoundName = Parameters<typeof sfx>[0];

const bars = (...bar: string[]) => bar.join(' | ');
/** A bar of the gallop: long-short-short on the root, then on the fifth, twice. */
const gallop = (root: string, fifth: string) => `${root} . ${root} ${root} ${fifth} . ${fifth} ${fifth} ${root} . ${root} ${root} ${fifth} . ${fifth} ${fifth}`;
/** Half a bar of the gallop, on two chords. */
const gallopSplit = (a: string, a5: string, b: string, b5: string) => `${a} . ${a} ${a} ${a5} . ${a5} ${a5} ${b} . ${b} ${b} ${b5} . ${b5} ${b5}`;
/** A bar of driving eighths on the root, an octave up on the off-beats now and then. */
const drive = (root: string, high: string) => `${root} - ${root} - ${high} - ${root} - ${root} - ${root} - ${high} - ${root} ${root}`;

/** The road's tune in D Mixolydian, eight bars over D, C, D, G-A, D, C, G, D. */
const ROAD_LEAD = bars(
  'a4 . f#4 . a4 . d5 . c5 . a4 . f#4 . g4 a4',
  'g4 . e4 . g4 . c5 . b4 . g4 . e4 . f#4 g4',
  'a4 . d5 . f#5 . e5 d5 c5 . a4 . b4 . c5 .',
  'd5 . b4 . g4 . b4 . a4 . . . - - - -',
  'f#5 . e5 . d5 . a4 . c5 . d5 . e5 . f#5 .',
  'g5 . e5 . c5 . g4 . c5 . e5 . d5 c5 b4 .',
  'b4 . d5 . g5 . d5 . c5 . b4 . a4 . g4 .',
  'a4 . d5 . . . a4 f#4 d4 . . . - - - -',
);
const ROAD_HARMONY = bars(
  'd4 . . . . . . . f#4 . . . e4 . . .',
  'e4 . . . . . . . g4 . . . e4 . . .',
  'f#4 . . . a4 . . . f#4 . . . g4 . . .',
  'g4 . . . d4 . . . e4 . . . a4 . . .',
  'a4 . . . f#4 . . . a4 . . . d5 . . .',
  'c5 . . . g4 . . . e4 . . . g4 . . .',
  'd4 . . . g4 . . . b4 . . . d5 . . .',
  'f#4 . . . . . . . d4 . . . - - - -',
);

/**
 * Hotfoot's song: a galloping chiptune at 150 BPM in D Mixolydian, with a square lead, a pulse
 * counter-melody, a triangle bass in a gallop and noise drums. One loop per ground (road, ice, fen,
 * wind, the Sky Road), the boss fights, the rockfall and the campfire of a checkpoint, plus two stings.
 */
export const SONG: Song = {
  bpm: 150,
  waves: { lead: 'square', harmony: 'pulse25', bass: 'triangle' },
  mix: { lead: 0.11, harmony: 0.07, bass: 0.26, drums: 0.26 },
  parts: {
    /** The old road: the main gallop. */
    road: {
      lead: ROAD_LEAD,
      harmony: ROAD_HARMONY,
      bass: bars(gallop('d2', 'a2'), gallop('c2', 'g2'), gallop('d2', 'a2'), gallopSplit('g2', 'd3', 'a2', 'e3'), gallop('d2', 'a2'), gallop('c2', 'g2'), gallop('g2', 'd3'), gallop('d2', 'a2')),
      drums: 'k - h k s - h - k - h k s - h h',
    },
    /** The Frozen Pass: high, sparkling staccato arpeggios. */
    ice: {
      lead: bars(
        'd6 - a5 - f#5 - a5 - d6 - a5 - f#5 - e5 -',
        'd6 - b5 - g5 - b5 - d6 - b5 - a5 - g5 -',
        'e6 - c6 - g5 - c6 - e6 - d6 - c6 - g5 -',
        'f#5 - a5 - d6 . . . a5 - d6 . . . - -',
      ),
      harmony: bars('a4 . . . . . . . f#4 . . . . . . .', 'b4 . . . . . . . g4 . . . . . . .', 'g4 . . . . . . . e4 . . . . . . .', 'a4 . . . . . . . f#4 . . . . . . .'),
      bass: bars('d2 . . d2 a2 . . . d2 . . d2 a2 . . .', 'g2 . . g2 d3 . . . g2 . . g2 d3 . . .', 'c2 . . c2 g2 . . . c2 . . c2 g2 . . .', 'd2 . . d2 a2 . . . d2 . . d2 a2 . . .'),
      drums: 'h - h h s - h - h - h h s - h -',
    },
    /** The Fen: low and murky, at half time. */
    fen: {
      lead: bars('d4 . . . f#4 . e4 . d4 . . . c4 . . .', 'c4 . . . e4 . d4 . c4 . . . a3 . . .', 'd4 . . . a4 . . . g4 . f#4 . e4 . . .', 'd4 . . . . . . . a3 . . . - - - -'),
      harmony: '- - a3 . - - a3 . - - g3 . - - e3 .',
      bass: bars('d2 . . . . . d2 . c2 . . . . . c2 .', 'd2 . . . . . d2 . a1 . . . . . a1 .'),
      drums: 'k - - - - - - - s - - - - - k -',
    },
    /** The Windy Pass: long, airy notes over quick arpeggios. */
    wind: {
      lead: bars('a5 . . . . . . . f#5 . . . g5 . . .', 'e5 . . . . . . . c5 . . . d5 . . .', 'f#5 . . . a5 . . . d6 . . . c6 . . .', 'a5 . . . . . . . . . . . - - - -'),
      harmony: bars(
        'd4 f#4 a4 d5 a4 f#4 d4 f#4 a4 d5 a4 f#4 d4 f#4 a4 d5',
        'c4 e4 g4 c5 g4 e4 c4 e4 g4 c5 g4 e4 c4 e4 g4 c5',
        'd4 f#4 a4 d5 a4 f#4 d4 f#4 a4 d5 a4 f#4 d4 f#4 a4 d5',
        'd4 f#4 a4 d5 a4 f#4 d4 f#4 a4 d5 a4 f#4 d4 f#4 a4 d5',
      ),
      bass: bars('d2 . . . . . . . a2 . . . . . . .', 'c2 . . . . . . . g2 . . . . . . .', 'd2 . . . . . . . a2 . . . . . . .', 'd2 . . . . . . . a2 . . . . . . .'),
      drums: 'k - - h s - - h k - - h s - - h',
    },
    /** The Gatekeeper and the dragon: a driving boss loop with a darker flat third and seventh. */
    boss: {
      lead: bars(
        'd5 . . d5 f5 . d5 . c5 . . c5 a4 . g4 .',
        'bb4 . . bb4 d5 . bb4 . c5 . e5 . g5 . . .',
        'a5 . g5 . f5 . d5 . c5 . d5 . f5 . e5 .',
        'd5 . . . a4 . . . c5 . . . d5 . . .',
      ),
      harmony: bars('- - a4 - - - a4 - - - g4 - - - g4 -', '- - f4 - - - f4 - - - g4 - - - e4 -'),
      bass: bars('d2 d3 d2 d3 d2 d3 d2 d3 c2 c3 c2 c3 c2 c3 c2 c3', 'bb1 bb2 bb1 bb2 bb1 bb2 bb1 bb2 c2 c3 c2 c3 c2 c3 c2 c3'),
      drums: 'k - h k s - h k k - h k s - s s',
    },
    /** The rockfall: the road's tune over a tense, driving bass and busier drums. */
    rockfall: {
      lead: ROAD_LEAD,
      harmony: ROAD_HARMONY,
      bass: bars(drive('d2', 'd3'), drive('c2', 'c3'), drive('d2', 'd3'), 'g2 - g2 - g3 - g2 - a2 - a2 - a3 - a2 a2', drive('d2', 'd3'), drive('c2', 'c3'), drive('g2', 'g3'), drive('d2', 'd3')),
      drums: 'k h s h k h s h k h s h k k s s',
    },
    /** The Sky Road beyond the Keep: a soaring lead in D Lydian over slow, bright chords. */
    sky: {
      lead: bars('d5 . . . e5 . f#5 . g#5 . . . a5 . . .', 'f#5 . . . e5 . d5 . e5 . . . . . . .', 'a5 . . . b5 . a5 . g#5 . f#5 . e5 . d5 .', 'e5 . . . . . . . d5 . . . - - - -'),
      harmony: bars('f#4 a4 d5 a4 f#4 a4 d5 a4 e4 g#4 b4 g#4 e4 g#4 b4 g#4', 'd4 f#4 a4 f#4 d4 f#4 a4 f#4 e4 a4 c#5 a4 e4 a4 c#5 a4'),
      bass: bars('d2 . . . . . . . e2 . . . . . . .', 'd2 . . . . . . . a1 . . . . . . .'),
      drums: 'k - - h - - h - s - - h - - h h',
    },
    /** The campfire at a checkpoint, and the game-over panel: a calm loop. */
    camp: {
      lead: bars('f#4 . . . a4 . . . d5 . . . . . c5 .', 'b4 . . . g4 . . . a4 . . . . . . .', 'f#4 . . . e4 . d4 . e4 . . . c4 . . .', 'd4 . . . . . . . . . . . - - - -'),
      harmony: bars('a3 . . . . . . . d4 . . . . . . .', 'g3 . . . . . . . b3 . . . . . . .', 'a3 . . . . . . . g3 . . . . . . .', 'f#3 . . . . . . . . . . . - - - -'),
      bass: bars('d2 . . . . . . . a2 . . . . . . .', 'g2 . . . . . . . d2 . . . . . . .', 'a2 . . . . . . . c3 . . . . . . .', 'd2 . . . . . . . . . . . . . . .'),
      drums: '- - h - - - h - - - h - - - h -',
    },
    /** The knight falls: a falling minor sting. */
    lose: {
      lead: bars('a4 . g4 . f4 . e4 . d4 . c#4 . d4 . . .', '. . . . . . . . - - - - - - - -'),
      harmony: bars('f4 . . . d4 . . . e4 . . . . . . .', 'f4 . . . . . . . - - - - - - - -'),
      bass: bars('d3 . . . bb2 . . . a2 . . . a2 . . .', 'd2 . . . . . . . . . . . - - - -'),
      drums: bars('k - - - - - - - k - - - - - - -', 's - - - - - - - - - - - - - - -'),
    },
    /** The dragon beaten and the crown won: a fanfare. */
    crown: {
      lead: bars('d5 - d5 d5 d5 . a4 . d5 . f#5 . a5 . . .', 'g5 . . . e5 . . . a5 . . . . . . .', 'd6 . . . . . . . . . . . - - - -'),
      harmony: bars('a4 - a4 a4 a4 . f#4 . a4 . d5 . f#5 . . .', 'b4 . . . c5 . . . c#5 . . . . . . .', 'f#5 . . . . . . . . . . . - - - -'),
      bass: bars('d2 - d2 d2 d2 . . . a2 . . . d3 . . .', 'g2 . . . . . . . a2 . . . . . . .', 'd2 . . . . . . . . . . . - - - -'),
      drums: bars('k - k k k - - - s - - - s - s s', 'k - - - s - - - k - s - s s s s', 'k - - - - - - - - - - - - - - -'),
    },
  },
};

/** The looping parts, by what the run is doing. */
export type MusicPart = 'road' | 'ice' | 'fen' | 'wind' | 'sky' | 'boss' | 'rockfall' | 'camp';
