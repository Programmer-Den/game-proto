import { sounds, type Song } from '../../../shared/audio';

/**
 * Broadside's sound, all made in code (`shared/audio.ts`): a sea-shanty jig in D Dorian, in 6/8
 * (three steps to a beat, so each written bar holds two 6/8 measures), and a table of short
 * synthesized effects. `GameScene` plays them; the sim never does.
 *
 * - `HARBOR_SONG` `calm`: the break before each wave and the harbor, slow and lilting.
 * - `BATTLE_SONG` `battle`: the fighting, a fast jig; `boss`: the heavier variation once a
 *   flagship (or the admiral at the haven) is on the sea.
 * - `STINGS`: `wave` (drum roll and horn as the wave comes), `harbor` (the harbor opens), `win`
 *   (the haven razed) and `lose` (the player's ship goes down).
 */

/** The harbor and the break: a slow shanty with held chords, about 100 eighths a minute. */
export const HARBOR_SONG: Song = {
  bpm: 66,
  steps: 3,
  waves: { lead: 'square', harmony: 'pulse25', bass: 'triangle' },
  mix: { lead: 0.11, harmony: 0.07, bass: 0.24, drums: 0.18 },
  parts: {
    calm: {
      lead:
        'd5 . . a4 . . | f4 . g4 a4 . . | c5 . . g4 . . | e4 . f4 g4 . . | ' +
        'd5 . e5 f5 . e5 | d5 . c5 a4 . . | g4 . a4 b4 . c5 | d5 . . . . - | ' +
        'f5 . . e5 . d5 | c5 . d5 e5 . . | d5 . . c5 . a4 | g4 . a4 c5 . . | ' +
        'a4 . . f4 . g4 | a4 . c5 d5 . c5 | a4 . g4 e4 . g4 | d4 . . . . -',
      harmony:
        'f4 . . . . . | a3 . . . . . | e4 . . . . . | g3 . . . . . | ' +
        'f4 . . . . . | a3 . . f4 . . | b3 . . d4 . . | f4 . . . . - | ' +
        'a4 . . . . . | g4 . . . . . | f4 . . . . . | e4 . . . . . | ' +
        'c4 . . . . . | f4 . . . . . | e4 . . c4 . . | a3 . . . . -',
      bass:
        'd3 . . a2 . . | d3 . . a2 . . | c3 . . g2 . . | c3 . . g2 . . | ' +
        'd3 . . a2 . . | f2 . . c3 . . | g2 . . d3 . . | d3 . . a2 . d3 | ' +
        'bb2 . . f2 . . | c3 . . g2 . . | d3 . . a2 . . | c3 . . g2 . . | ' +
        'f2 . . c3 . . | d3 . . a2 . . | c3 . . g2 . . | d3 . . a2 . .',
      drums: 'k - - h - - | k - h h - - | k - - h - - | k - h - - h',
    },
  },
};

/** The fighting: a quick jig, and a heavier minor variation for flagship waves and the haven. */
export const BATTLE_SONG: Song = {
  bpm: 112,
  steps: 3,
  waves: { lead: 'square', harmony: 'pulse25', bass: 'triangle' },
  mix: { lead: 0.1, harmony: 0.06, bass: 0.26, drums: 0.24 },
  parts: {
    battle: {
      lead:
        'd5 e5 f5 a5 f5 d5 | c5 d5 e5 g5 e5 c5 | d5 e5 f5 a5 g5 f5 | e5 d5 c5 d5 . . | ' +
        'f5 g5 a5 c6 a5 f5 | g5 a5 g5 e5 . c5 | b4 c5 d5 g5 f5 e5 | d5 . a4 d5 . . | ' +
        'a5 . f5 a5 . f5 | g5 . e5 c5 . e5 | f5 e5 d5 e5 f5 g5 | a5 . . e5 . . | ' +
        'd5 f5 a5 g5 f5 e5 | c5 e5 g5 f5 e5 d5 | b4 d5 g5 e5 c5 e5 | d5 . . d5 . -',
      harmony:
        '- f4 f4 - a4 a4 | - e4 e4 - g4 g4 | - f4 f4 - a4 a4 | - e4 e4 - g4 g4 | ' +
        '- a4 a4 - c5 c5 | - g4 g4 - e4 e4 | - d4 d4 - b4 b4 | - f4 f4 - a4 - | ' +
        '- f4 f4 - a4 a4 | - e4 e4 - g4 g4 | - f4 f4 - a4 a4 | - c#4 c#4 - e4 e4 | ' +
        '- f4 f4 - a4 a4 | - e4 e4 - g4 g4 | - d4 d4 - b4 b4 | - f4 f4 - a4 -',
      bass:
        'd3 . . a2 . . | c3 . . g2 . . | d3 . . a2 . . | c3 . . g2 . . | ' +
        'f2 . . c3 . . | c3 . . g2 . . | g2 . . d3 . . | d3 . a2 d3 . . | ' +
        'd3 . . a2 . . | c3 . . g2 . . | d3 . . f2 . . | a2 . . e2 . . | ' +
        'd3 . . a2 . . | c3 . . g2 . . | g2 . . b2 . . | d3 . a2 d3 . .',
      drums:
        'k - h s - h | k - h s - h | k - h s - h | k - h s s s | ' +
        'k - h s - h | k - h s - h | k - h s - h | k s s k s s',
    },
    boss: {
      lead:
        'a4 . a4 d5 . f5 | e5 . d5 c#5 . a4 | bb4 . a4 g4 . bb4 | a4 . . . . . | ' +
        'd5 . f5 a5 . f5 | g5 . f5 e5 . c#5 | d5 . e5 f5 e5 c#5 | d5 . . d4 . .',
      harmony:
        'd4 . . . . . | c#4 . . e4 . . | bb3 . . d4 . . | c#4 . . e4 . . | ' +
        'f4 . . . . . | e4 . . . . . | a3 . . g4 . . | f4 . . a3 . .',
      bass:
        'd2 d2 d3 d2 d2 d3 | a1 a1 a2 a1 a1 a2 | bb1 bb1 bb2 bb1 bb1 bb2 | a1 a1 a2 a1 a2 a1 | ' +
        'd2 d2 d3 d2 d2 d3 | a1 a1 a2 a1 a1 a2 | bb1 bb1 bb2 a1 a1 a2 | d2 . . d2 . .',
      drums:
        'k - k s - h | k - k s - h | k - k s - h | k - k s s s | ' +
        'k - k s - h | k - k s - h | k - k s - h | k s s k s s',
    },
  },
};

/** Short tunes played once over the music. */
export const STINGS: Song = {
  bpm: 100,
  steps: 3,
  waves: { lead: 'square', harmony: 'pulse25', bass: 'triangle' },
  mix: { lead: 0.13, harmony: 0.07, bass: 0.26, drums: 0.28 },
  parts: {
    /** The wave comes: a drum roll and a horn call. */
    wave: {
      lead: '- - - - - - a4 . d5 . . a5 | . . . . . -',
      harmony: '- - - - - - f4 . a4 . . d5 | . . . . . -',
      bass: '- - - - - - d3 . . . . d2 | . . . . . -',
      drums: 's s s s s s k - - s - - | k - - - - -',
    },
    /** The harbor opens: a bright run up to the octave. */
    harbor: {
      lead: 'a4 d5 f5 a5 . . d6 . . . . -',
      harmony: 'f4 . . . . . a4 . . . . -',
      bass: 'd3 . . a2 . . d2 . . . . -',
      drums: 'k - - h - - k - - - - -',
    },
    /** The campaign won: a fanfare in D major. */
    win: {
      lead: 'd5 . d5 f#5 . a5 d6 . . a5 . f#5 | g5 . b5 d6 . e6 f#6 . . . . -',
      harmony: 'a4 . . . . . f#4 . . . . . | b4 . . c#5 . . a4 . . . . -',
      bass: 'd3 . . a2 . . d3 . . a2 . . | g2 . . a2 . . d2 . . . . -',
      drums: 'k - - s - - k - - s - - | k - s k - s k s s s - -',
    },
    /** The player's ship goes down: a slow dirge falling to D. */
    lose: {
      lead: 'a4 . . g4 . . f4 . . e4 . . | d4 . . . . . . . . . . -',
      harmony: 'f4 . . . . . d4 . . . . . | c#4 . . . . . a3 . . . . -',
      bass: 'd3 . . . . . bb2 . . . . . | a2 . . . . . d2 . . . . -',
      drums: 'k - - - - - k - - - - - | k - - - - - - - - - - -',
    },
  },
};

/**
 * The effects. Hits, splashes and enemy guns come many at a time, so the scene plays each at
 * most once a frame and their gaps thin them out further.
 */
export const sfx = sounds({
  /** A tick of the charge, played over and over with its pitch rising as the charge fills. */
  charge: { wave: 'triangle', freq: 300, to: 340, length: 0.09, volume: 0.16, gap: 85 },
  /** The charge is full: let go. */
  charged: { wave: 'pulse25', freq: 660, arp: [0, 7], arpStep: 0.05, length: 0.12, volume: 0.18, gap: 200 },
  /** One gun of the player's broadside: a burst of smoke and powder. */
  cannon: { wave: 'noise', freq: 1400, to: 90, length: 0.5, volume: 0.5, vary: 0.08, gap: 45 },
  /** The low thump under each of the player's guns. */
  thump: { wave: 'sine', freq: 120, to: 38, length: 0.32, volume: 0.55, vary: 0.05, gap: 45 },
  /** Grapeshot's rattle, over the boom. */
  grape: { wave: 'noise', freq: 5000, to: 2200, length: 0.28, volume: 0.2, gap: 120 },
  /** An enemy's or a prize's broadside on screen: the same boom, further off. */
  distant: { wave: 'noise', freq: 800, to: 70, length: 0.45, volume: 0.28, vary: 0.1, gap: 160 },
  /** A mortar or fort lobbing a shell: a hollow thump. */
  mortar: { wave: 'triangle', freq: 180, to: 70, length: 0.22, volume: 0.4, vary: 0.05, gap: 150 },
  /** A shell on its way down. */
  whistle: { wave: 'sine', freq: 1500, to: 450, length: 0.7, attack: 0.15, volume: 0.1, gap: 250 },
  /** A ball striking timber. */
  hit: { wave: 'noise', freq: 2600, to: 600, length: 0.12, volume: 0.32, vary: 0.12, gap: 70 },
  /** A ball striking the player's own hull: heavier. */
  hurt: { wave: 'square', freq: 140, to: 60, length: 0.18, volume: 0.3, vary: 0.05, gap: 120 },
  /** A ball falling short. */
  splash: { wave: 'noise', freq: 3200, to: 900, length: 0.22, attack: 0.02, volume: 0.16, vary: 0.15, gap: 90 },
  /** A shell or a fireship going up. */
  blast: { wave: 'noise', freq: 600, to: 40, length: 0.7, volume: 0.55, vary: 0.06, gap: 120 },
  /** Running aground: a grinding thud. */
  aground: { wave: 'sawtooth', freq: 90, to: 45, length: 0.35, volume: 0.3, gap: 300 },
  /** A ship going down: a falling rumble. */
  sink: { wave: 'noise', freq: 400, to: 60, length: 0.9, attack: 0.03, volume: 0.4, gap: 200 },
  /** The gurgle as she goes under. */
  gurgle: { wave: 'sine', freq: 300, to: 120, arp: [0, 3, -2, 1, -4, 0, -6], arpStep: 0.07, length: 0.5, volume: 0.18, gap: 200 },
  /** A prize taken: the boarders' hurrah. */
  prize: { wave: 'pulse25', freq: 587, arp: [0, 4, 7, 12], arpStep: 0.07, length: 0.36, volume: 0.28, gap: 300 },
  /** The Admiralty's bounty paid at the harbor: a full chord. */
  bounty: { wave: 'square', freq: 784, arp: [0, 4, 7, 12, 16], arpStep: 0.05, length: 0.4, volume: 0.24, gap: 300 },
  /** A merchantman gets clean away, or the convoy is lost. */
  escape: { wave: 'triangle', freq: 440, arp: [0, -5], arpStep: 0.18, length: 0.38, volume: 0.3, gap: 400 },
  /** The convoy reaches her island: a ship's bell. */
  bell: { wave: 'sine', freq: 1320, arp: [0, 0, 0], arpStep: 0.2, length: 0.6, volume: 0.3, gap: 600 },
  /** A sail on the horizon: the bosun's pipe. */
  pipe: { wave: 'pulse12', freq: 1175, to: 1480, arp: [0, 5], arpStep: 0.12, length: 0.24, volume: 0.13, gap: 500 },
  /** A squall in the Storm Reaches: the wind swings round with a rush of rain. */
  squall: { wave: 'noise', freq: 1200, to: 260, length: 1.4, attack: 0.35, volume: 0.32, gap: 1500 },
  /** The helm put over: a creak of the tiller ropes. */
  creak: { wave: 'sawtooth', freq: 210, to: 160, length: 0.14, attack: 0.03, volume: 0.1, vary: 0.1, gap: 350 },
});

export type SoundName = Parameters<typeof sfx>[0];
