import { sounds, type Song } from '../../../shared/audio';
import type { Building } from './game/tiles';

/**
 * Tiny Kingdom's sound: a bouncy pastoral song in G major at 100 BPM with a music-box lead, one
 * part per season (the round's season picks it), an omen motif and stings for a finished
 * kingdom and a new best, plus a table of soft wooden effects. `GameScene` plays all of it.
 */
export const SONG: Song = {
  bpm: 100,
  waves: { lead: 'pulse12' },
  mix: { lead: 0.15, harmony: 0.05, bass: 0.24, drums: 0.2 },
  parts: {
    // Round 1, 5, ...: the main tune, eight bars over G C D G Em C Am-D G.
    spring: {
      lead:
        'd5 . b4 . g4 . b4 . d5 . . . g5 . . . | e5 . c5 . e5 . g5 . e5 . d5 . c5 . . . | a4 . f#4 . a4 . d5 . c5 . b4 . a4 . . . | b4 . d5 . g4 . . . - - g4 . a4 . b4 . | ' +
        'e5 . g5 . e5 . b4 . c5 . d5 . e5 . . . | c5 . e5 . g5 . e5 . d5 . c5 . b4 . a4 . | a4 . c5 . e5 . c5 . d5 . . . f#5 . . . | g5 . . . d5 . b4 . g4 . . . - - - -',
      harmony:
        'b3 . . . . . . . d4 . . . . . . . | e4 . . . . . . . g4 . . . . . . . | f#4 . . . . . . . a4 . . . . . . . | d4 . . . . . . . b3 . . . . . . . | ' +
        'g4 . . . . . . . b3 . . . . . . . | e4 . . . . . . . c4 . . . . . . . | c4 . . . . . . . f#4 . . . . . . . | d4 . . . . . . . b3 . . . - - - -',
      bass:
        'g2 . . . d3 . . . g2 . . . d3 . b2 . | c3 . . . g2 . . . c3 . . . g2 . . . | d3 . . . a2 . . . d3 . . . a2 . f#2 . | g2 . . . d3 . . . g2 . . . g2 . . . | ' +
        'e2 . . . b2 . . . e2 . . . b2 . . . | c3 . . . g2 . . . c3 . . . e3 . . . | a2 . . . e3 . . . d3 . . . a2 . . . | g2 . . . d3 . . . g2 . . . - - - -',
      drums: 'k - h - s - h - k - h k s - h -',
    },
    // Summer: brighter and busier, over G D Em C-D.
    summer: {
      lead: 'g5 . d5 . b4 . d5 . g5 . a5 . b5 . g5 . | a5 . f#5 . d5 . f#5 . a5 . . . f#5 . e5 . | e5 . g5 . b5 . g5 . e5 . d5 . b4 . d5 . | c5 . e5 . g5 . e5 . d5 . . . f#5 . a5 .',
      harmony: '- - d4 - - - b3 - - - d4 - - - b3 - | - - f#4 - - - a3 - - - f#4 - - - a3 - | - - g4 - - - e4 - - - g4 - - - b3 - | - - e4 - - - g4 - - - f#4 - - - a4 -',
      bass: 'g2 . g3 . g2 . g3 . g2 . g3 . g2 . g3 . | d3 . a2 . d3 . a2 . d3 . a2 . d3 . a2 . | e2 . e3 . e2 . e3 . e2 . e3 . e2 . e3 . | c3 . c3 . g2 . c3 . d3 . d3 . a2 . d3 .',
      drums: 'k - h h s - h - k k h - s - h h',
    },
    // Autumn: slower steps and a minor turn, over Em C G D.
    autumn: {
      lead: 'b4 . . . g4 . . . e4 . . . g4 . a4 . | g4 . . . e4 . . . c5 . . . b4 . a4 . | b4 . . . d5 . . . g5 . . . f#5 . e5 . | d5 . . . . . a4 . f#4 . . . a4 . . .',
      harmony: 'g3 . . . . . . . b3 . . . . . . . | g3 . . . . . . . e4 . . . . . . . | b3 . . . . . . . d4 . . . . . . . | a3 . . . . . . . f#3 . . . . . . .',
      bass: 'e2 . . . b2 . . . e3 . . . b2 . . . | c3 . . . g2 . . . c3 . . . g2 . . . | g2 . . . d3 . . . g3 . . . d3 . . . | d3 . . . a2 . . . d3 . . . f#2 . . .',
      drums: 'k - - - h - - - s - - - h - - h',
    },
    // Winter: a sparse music box up high, over G C Am D.
    winter: {
      lead: 'd6 . . . b5 . . . g5 . . . b5 . . . | c6 . . . g5 . . . e5 . . . g5 . . . | e5 . . . a5 . . . c6 . . . b5 . a5 . | f#5 . . . . . . . d5 . . . - - - -',
      harmony: 'b3 . . . . . . . . . . . . . . . | c4 . . . . . . . . . . . . . . . | c4 . . . . . . . . . . . . . . . | a3 . . . . . . . . . . . . . . .',
      bass: 'g2 . . . . . . . d3 . . . . . . . | c3 . . . . . . . g2 . . . . . . . | a2 . . . . . . . e3 . . . . . . . | d3 . . . . . . . a2 . . . . . . .',
      drums: 'k - - - - - h - - - - - h - - -',
    },
    // A sting when a round brings an omen: a falling E minor phrase.
    omen: {
      lead: 'b4 . . . c5 . . . b4 . . . f#4 . . . | e4 . . . . . . . - - - - - - - -',
      harmony: 'g3 . . . . . . . d#4 . . . . . . . | e3 . . . . . . . - - - - - - - -',
      bass: 'e2 . . . . . . . c2 . . . b1 . . . | e2 . . . . . . . - - - - - - - -',
      drums: 'k - - - - - - - k - - - - - - - | s - - - - - - - - - - - - - - -',
    },
    // A sting for a finished kingdom: a cadence home to G.
    finished: {
      lead: 'g4 . b4 . d5 . g5 . . . d5 . e5 . f#5 . | g5 . . . . . . . - - - - - - - -',
      harmony: 'b3 . . . . . . . e4 . . . f#4 . . . | b4 . . . . . . . - - - - - - - -',
      bass: 'g2 . . . . . . . c3 . . . d3 . . . | g2 . . . . . . . - - - - - - - -',
      drums: 'k - - - s - - - k - - - s - s - | k - - - - - - - - - - - - - - -',
    },
    // A sting for a new best score: a short royal fanfare.
    best: {
      lead: 'd5 . d5 . d5 . g5 . . . . . b5 . . . | a5 . b5 . c6 . d6 . . . . . . . - -',
      harmony: 'b4 . b4 . b4 . d5 . . . . . g5 . . . | f#5 . g5 . a5 . b5 . . . . . . . - -',
      bass: 'g2 . . . g2 . . . g2 . . . e2 . . . | d3 . . . d3 . . . g2 . . . . . - -',
      drums: 'k - s - k - s - k - s - k k s s | k - - - s - - - k - - - - - - -',
    },
  },
};

/** The effects, all short and soft. */
export const sfx = sounds({
  /** A tile button picked, or a house picked to merge: a light wooden click. */
  select: { wave: 'triangle', freq: 1300, to: 900, length: 0.045, volume: 0.35, vary: 0.03 },
  /** A building set down: a wooden "tok", pitched by kind. */
  place: { wave: 'triangle', freq: 560, to: 260, length: 0.1, volume: 0.5, vary: 0.03, gap: 60 },
  /** A building's worth went up: a rising blip, played rising for each popup. */
  gain: { wave: 'pulse25', freq: 660, to: 990, length: 0.07, volume: 0.2, gap: 30 },
  /** A building's worth went down. */
  loss: { wave: 'triangle', freq: 330, to: 200, length: 0.14, volume: 0.32 },
  /** Two houses merged: the thunk, then the ding. */
  thunk: { wave: 'triangle', freq: 200, to: 80, length: 0.13, volume: 0.5 },
  ding: { wave: 'sine', freq: 1319, length: 0.4, volume: 0.25, attack: 0.003 },
  /** A wood cleared by a lumber camp: an axe chop with a rustle. */
  chop: { wave: 'noise', freq: 2400, to: 500, length: 0.16, volume: 0.3, attack: 0.002 },
  /** A market trade made: a jingle of coins. */
  jingle: { wave: 'square', freq: 1319, arp: [0, 4, 7, 12], arpStep: 0.045, length: 0.22, volume: 0.22 },
  /** A placement taken back: a soft reverse swoosh. */
  undo: { wave: 'noise', freq: 900, to: 5000, attack: 0.16, length: 0.2, volume: 0.18 },
  /** The round's decree fulfilled: three regal notes. */
  decree: { wave: 'pulse25', freq: 392, arp: [0, 4, 7], arpStep: 0.11, length: 0.45, volume: 0.32 },
  /** The round's goal reached: a rising arpeggio. */
  goal: { wave: 'square', freq: 523, arp: [0, 4, 7, 12, 16], arpStep: 0.06, length: 0.4, volume: 0.24 },
  /** A gift taken. */
  gift: { wave: 'square', freq: 660, arp: [0, 7], arpStep: 0.07, length: 0.18, volume: 0.26 },
  /** The omen's flood strikes: a water sweep. */
  flood: { wave: 'noise', freq: 700, to: 120, attack: 0.08, length: 0.65, volume: 0.28 },
  /** The omen's storm topples a tower: a roll of thunder. */
  storm: { wave: 'noise', freq: 140, to: 35, attack: 0.01, length: 0.85, volume: 0.45 },
  /** The castle's joined buildings tallied at the end. */
  tick: { wave: 'square', freq: 1760, length: 0.025, volume: 0.12, gap: 30 },
  /** A campaign star won at the end, played rising for each star. */
  star: { wave: 'sine', freq: 1568, length: 0.32, volume: 0.28, attack: 0.003, gap: 30 },
});

/** How a building's "tok" is pitched: big ones lower, towers higher. */
export const PLACE_PITCH: Record<Building, number> = {
  farm: 0.85,
  house: 1,
  tower: 1.2,
  windmill: 1.1,
  market: 1.05,
  harbor: 0.9,
  lumber: 0.95,
  temple: 1.15,
  lighthouse: 1.25,
  orchard: 0.9,
  road: 0.75,
};
