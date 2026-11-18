import { sounds, type Song } from '../../../shared/audio';

/**
 * Scrapyard Titans' sound: one table of synthesized effects and two songs of industrial chiptune
 * in E minor, since planning and fights run at different tempos (`playMusic` fades from one song
 * to the other). GameScene plays all of it; the sim in `game/` stays free of audio.
 */

/** Shop and planning (`calm`) and the draft carousel (`draft`), 110 BPM. */
export const PLAN_SONG: Song = {
  bpm: 110,
  parts: {
    calm: {
      lead:
        'e5 . . . g5 . b5 . a5 . g5 . f#5 . e5 . | g5 . . . e5 . c5 . d5 . e5 . g5 . . . | ' +
        'a5 . . . c6 . b5 . a5 . g5 . e5 . . . | f#5 . . . d#5 . f#5 . b5 . . . a5 . f#5 . | ' +
        'e5 . g5 . b5 . e6 . d6 . b5 . g5 . . . | c6 . b5 . g5 . e5 . g5 . . . c6 . b5 . | ' +
        'a5 . f#5 . d5 . f#5 . a5 . . . d6 . c6 . | b5 . . . a5 . f#5 . d#5 . . . - - - -',
      harmony:
        '- - g4 - - - b4 - - - g4 - - - b4 - | - - g4 - - - e4 - - - g4 - - - e4 - | ' +
        '- - a4 - - - e4 - - - a4 - - - c5 - | - - f#4 - - - d#4 - - - f#4 - - - b4 - | ' +
        '- - g4 - - - b4 - - - g4 - - - b4 - | - - g4 - - - e4 - - - g4 - - - e4 - | ' +
        '- - f#4 - - - a4 - - - f#4 - - - d4 - | - - f#4 - - - d#4 - - - f#4 - - - b4 -',
      bass:
        'e2 . e3 . e2 . e3 . e2 . e3 . d3 . b2 . | c3 . c3 . g2 . c3 . c3 . c3 . g2 . c3 . | ' +
        'a2 . a3 . a2 . a3 . a2 . a3 . g3 . e3 . | b2 . b2 . f#2 . b2 . b2 . b2 . a2 . f#2 . | ' +
        'e2 . e3 . e2 . e3 . e2 . e3 . d3 . b2 . | c3 . c3 . g2 . c3 . c3 . c3 . g2 . c3 . | ' +
        'd3 . d3 . a2 . d3 . d3 . d3 . a2 . f#2 . | b2 . b2 . f#2 . b2 . b2 . b2 . a2 . f#2 .',
      drums: 'k - h - s - h - k - h k s - h - | k - h - s - h - k k h - s - h h',
    },
    draft: {
      lead:
        'e5 g5 b5 g5 e5 g5 b5 g5 e5 g5 b5 g5 d6 . b5 . | c5 e5 g5 e5 c5 e5 g5 e5 c5 e5 g5 e5 b5 . g5 . | ' +
        'd5 g5 b5 g5 d5 g5 b5 g5 d5 g5 b5 g5 d6 . b5 . | d5 f#5 a5 f#5 d5 f#5 a5 f#5 a5 . f#5 . d5 . . .',
      harmony:
        'b3 . . . . . . . . . . . . . . . | c4 . . . . . . . . . . . . . . . | ' +
        'b3 . . . . . . . . . . . . . . . | a3 . . . . . . . . . . . . . . .',
      bass:
        'e2 . . . e3 . . . e2 . . . e3 . . . | c2 . . . c3 . . . c2 . . . c3 . . . | ' +
        'g2 . . . g3 . . . g2 . . . g3 . . . | d2 . . . d3 . . . d2 . . . d3 . . .',
      drums: 'k - - - h - - - s - - - h - - h',
    },
  },
};

/** Fights (`battle`), the Scrap Rat chase (`rat`) and every sting, 140 BPM. */
export const FIGHT_SONG: Song = {
  bpm: 140,
  waves: { harmony: 'pulse12' },
  parts: {
    battle: {
      lead:
        'e5 . e5 b4 e5 . g5 . f#5 . e5 . d5 . b4 . | c5 . c5 g4 c5 . e5 . g5 . e5 . c5 . e5 . | ' +
        'd5 . d5 a4 d5 . f#5 . a5 . f#5 . d5 . f#5 . | e5 . . . b5 . . . g5 . a5 . b5 . . . | ' +
        'e6 . d6 . b5 . g5 . b5 . g5 . e5 . g5 . | d6 . b5 . g5 . d5 . g5 . b5 . d6 . g6 . | ' +
        'e6 . c#6 . a5 . e5 . a5 . c#6 . e6 . a6 . | f#6 . . . d#6 . . . b5 . . . a5 . f#5 .',
      harmony:
        'b4 - b4 - - b4 - b4 b4 - b4 - - b4 - b4 | g4 - g4 - - g4 - g4 g4 - g4 - - g4 - g4 | ' +
        'a4 - a4 - - a4 - a4 a4 - a4 - - a4 - a4 | b4 - b4 - - b4 - b4 b4 - b4 - - b4 - b4 | ' +
        'b4 - b4 - - b4 - b4 b4 - b4 - - b4 - b4 | d5 - d5 - - d5 - d5 d5 - d5 - - d5 - d5 | ' +
        'e5 - e5 - - e5 - e5 e5 - e5 - - e5 - e5 | f#4 - f#4 - - f#4 - f#4 f#4 - f#4 - - f#4 - f#4',
      bass:
        'e2 . e2 . e3 . e2 . e2 . e2 . e3 . e2 . | c2 . c2 . c3 . c2 . c2 . c2 . c3 . c2 . | ' +
        'd2 . d2 . d3 . d2 . d2 . d2 . d3 . d2 . | e2 . e2 . e3 . e2 . e2 . e2 . e3 . d3 . | ' +
        'e2 . e2 . e3 . e2 . e2 . e2 . e3 . e2 . | g2 . g2 . g3 . g2 . g2 . g2 . g3 . g2 . | ' +
        'a2 . a2 . a3 . a2 . a2 . a2 . a3 . a2 . | b1 . b1 . b2 . b1 . b1 . b1 . b2 . a2 .',
      drums: 'k - h - s - h k k - h - s - h h | k - h k s - h - k k h - s - s s',
    },
    rat: {
      lead:
        'e5 f5 e5 d#5 e5 g5 f#5 e5 b5 a#5 b5 a5 g5 f#5 e5 d#5 | e5 f5 e5 d#5 e5 g5 f#5 e5 c6 b5 a5 g5 f#5 e5 d#5 e5 | ' +
        'g5 g#5 g5 f#5 g5 a#5 a5 g5 d6 c#6 d6 c6 a#5 a5 g5 f#5 | e6 . d#6 . d6 . c#6 . c6 . b5 . a#5 . b5 .',
      harmony:
        '- - e4 - - - e4 - - - e4 - - - e4 - | - - e4 - - - e4 - - - e4 - - - e4 - | ' +
        '- - g4 - - - g4 - - - g4 - - - g4 - | - - b4 - - - b4 - - - b4 - - - b4 -',
      bass:
        'e2 e3 e2 e3 e2 e3 e2 e3 e2 e3 e2 e3 e2 e3 e2 e3 | e2 e3 e2 e3 e2 e3 e2 e3 e2 e3 e2 e3 e2 e3 e2 e3 | ' +
        'g2 g3 g2 g3 g2 g3 g2 g3 g2 g3 g2 g3 g2 g3 g2 g3 | b1 b2 b1 b2 b1 b2 b1 b2 b1 b2 b1 b2 b1 b2 b1 b2',
      drums: 'k h s h k h s h k h s h k k s s',
    },
    roundWin: {
      lead: 'b4 e5 g5 b5 e6 . . . . . . .',
      harmony: 'g4 b4 e5 g5 b5 . . . . . . .',
      bass: 'e2 . . . e3 . . . . . . .',
      drums: 'k - - - s - - - - - - -',
    },
    roundLoss: {
      lead: 'b4 . a4 . g4 . f#4 . e4 . . . . . . .',
      harmony: 'g4 . f#4 . e4 . d#4 . b3 . . . . . . .',
      bass: 'e3 . d3 . c3 . b2 . e2 . . . . . . .',
      drums: 'k - - - k - - - s - - - - - - -',
    },
    roundDraw: {
      lead: 'e5 . b4 . e5 . . . . . . .',
      harmony: 'b4 . g4 . b4 . . . . . . .',
      bass: 'e2 . . . e2 . . . . . . .',
      drums: 'k - - - k - - - - - - -',
    },
    matchWon: {
      lead: 'e5 . g5 . b5 . e6 . . . d6 . e6 . . . | g6 . f#6 . e6 . d6 . e6 . . . . . . .',
      harmony: 'b4 . e5 . g5 . b5 . . . a5 . b5 . . . | b5 . a5 . g#5 . f#5 . g#5 . . . . . . .',
      bass: 'e2 . e3 . e2 . e3 . c3 . d3 . e3 . . . | c3 . d3 . b2 . b2 . e2 . . . . . . .',
      drums: 'k - h - s - h - k - s - k s s s | k - - - s - - - k - - - - - - -',
    },
    eliminated: {
      lead: 'b4 . . . a#4 . . . a4 . . . g#4 . . . | e4 . . . . . . . - - - - - - - -',
      harmony: 'g4 . . . f#4 . . . f4 . . . e4 . . . | b3 . . . . . . . - - - - - - - -',
      bass: 'e3 . . . d#3 . . . d3 . . . c#3 . . . | e2 . . . . . . . - - - - - - - -',
      drums: 'k - - - - - - - k - - - - - - - | k - - - - - - - - - - - - - - -',
    },
    /** The end of a watched match: neither a win nor a loss for anyone watching. */
    watchEnd: {
      lead: 'e5 . b5 . e6 . . . . . . . . . . .',
      harmony: 'b4 . e5 . b5 . . . . . . . . . . .',
      bass: 'e2 . . . e3 . . . . . . . . . . .',
      drums: 'k - - - s - - - - - - - - - - -',
    },
  },
};

export const play = sounds({
  // Shop and planning.
  buy: { wave: 'square', freq: 330, arp: [0, 7, 12], arpStep: 0.04, length: 0.14, volume: 0.28 },
  reroll: { wave: 'pulse25', freq: 200, to: 900, arp: [0, 3, 0, 3, 0], arpStep: 0.04, length: 0.22, volume: 0.22, gap: 120 },
  xp: { wave: 'triangle', freq: 440, to: 880, length: 0.12, volume: 0.35, gap: 80 },
  levelUp: { wave: 'pulse25', freq: 523, arp: [0, 4, 7, 12], arpStep: 0.07, length: 0.36, volume: 0.3, gap: 200 },
  sell: { wave: 'square', freq: 1400, to: 700, length: 0.12, volume: 0.22, gap: 80 },
  latch: { wave: 'square', freq: 1200, to: 400, length: 0.04, volume: 0.22, gap: 80 },
  place: { wave: 'square', freq: 220, to: 130, length: 0.07, volume: 0.28, vary: 0.06 },
  starUp: { wave: 'pulse25', freq: 659, arp: [0, 7, 12, 19], arpStep: 0.05, length: 0.4, volume: 0.32, gap: 200 },
  bolt: { wave: 'noise', freq: 2400, arp: [0, -5, 0, -5], arpStep: 0.025, length: 0.12, volume: 0.25 },
  itemBuilt: { wave: 'triangle', freq: 1047, arp: [0, 4, 7], arpStep: 0.06, length: 0.3, volume: 0.35, gap: 150 },
  tick: { wave: 'square', freq: 1800, length: 0.03, volume: 0.14, gap: 300 },
  fight: { wave: 'sawtooth', freq: 220, to: 330, attack: 0.03, length: 0.45, volume: 0.28, gap: 500 },
  augment: { wave: 'sine', freq: 784, arp: [0, 4, 7, 11, 14], arpStep: 0.05, length: 0.4, volume: 0.3, gap: 300 },
  draft: { wave: 'square', freq: 660, arp: [0, 7], arpStep: 0.06, length: 0.14, volume: 0.26, gap: 200 },
  // Fights: hard rate limits, since 2x speed with 16 robots makes a lot of events.
  punch: { wave: 'noise', freq: 900, to: 300, length: 0.07, volume: 0.26, gap: 70, vary: 0.1 },
  shot: { wave: 'pulse25', freq: 1400, to: 300, length: 0.1, volume: 0.16, gap: 70, vary: 0.08 },
  shell: { wave: 'triangle', freq: 160, to: 50, length: 0.18, volume: 0.45, gap: 120, vary: 0.06 },
  snipe: { wave: 'noise', freq: 6000, to: 2000, length: 0.09, volume: 0.28, gap: 120, vary: 0.05 },
  hit: { wave: 'square', freq: 600, to: 400, length: 0.03, volume: 0.1, gap: 60, vary: 0.1 },
  crit: { wave: 'square', freq: 1568, to: 1175, length: 0.16, volume: 0.22, gap: 100, vary: 0.04 },
  castShield: { wave: 'triangle', freq: 220, to: 330, length: 0.3, volume: 0.3, gap: 150 },
  castSlam: { wave: 'noise', freq: 400, to: 60, length: 0.35, volume: 0.45, gap: 150 },
  castBarrage: { wave: 'noise', freq: 1500, arp: [0, 7, 0, 7, 0, 7], arpStep: 0.04, length: 0.26, volume: 0.26, gap: 150 },
  castSnipe: { wave: 'sine', freq: 880, to: 1760, length: 0.25, volume: 0.28, gap: 150 },
  blink: { wave: 'pulse12', freq: 300, to: 2400, length: 0.12, volume: 0.2, gap: 120 },
  castRepair: { wave: 'square', freq: 400, arp: [0, 3, 7, 12], arpStep: 0.04, length: 0.2, volume: 0.2, gap: 150 },
  lightning: { wave: 'noise', freq: 5000, to: 1500, arp: [0, 12, 0, 7, 0], arpStep: 0.03, length: 0.22, volume: 0.28, gap: 120 },
  heal: { wave: 'triangle', freq: 523, to: 1047, length: 0.18, volume: 0.2, gap: 150 },
  shield: { wave: 'sine', freq: 330, to: 440, length: 0.2, volume: 0.2, gap: 150 },
  stun: { wave: 'square', freq: 500, arp: [0, 3, 0, 3, 0, 3], arpStep: 0.04, length: 0.25, volume: 0.16, gap: 200 },
  dodge: { wave: 'noise', freq: 2500, to: 6000, attack: 0.04, length: 0.12, volume: 0.18, gap: 120 },
  revive: { wave: 'pulse25', freq: 392, arp: [0, 7, 12, 16], arpStep: 0.06, length: 0.34, volume: 0.3, gap: 200 },
  death: { wave: 'noise', freq: 1200, to: 150, length: 0.32, volume: 0.38, gap: 80, vary: 0.08 },
  skill: { wave: 'noise', freq: 800, to: 5000, attack: 0.15, length: 0.5, volume: 0.38, gap: 300 },
  overdrive: { wave: 'sawtooth', freq: 110, to: 880, arp: [0, 7, 12, 19], arpStep: 0.06, attack: 0.02, length: 0.6, volume: 0.34, gap: 400 },
  /** A new stage event called out at the start of its stage. */
  stageEvent: { wave: 'pulse25', freq: 392, arp: [0, 5, 10], arpStep: 0.09, length: 0.36, volume: 0.24, gap: 400 },
  zap: { wave: 'sawtooth', freq: 1800, to: 600, length: 0.14, volume: 0.22, gap: 100 },
  escape: { wave: 'square', freq: 600, to: 1800, length: 0.25, volume: 0.22, gap: 300 },
  orb: { wave: 'triangle', freq: 1319, arp: [0, 7, 12], arpStep: 0.04, length: 0.2, volume: 0.26, gap: 100 },
});

export type Sfx = Parameters<typeof play>[0];
