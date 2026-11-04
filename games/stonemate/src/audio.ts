import { sounds, type Song } from '../../../shared/audio';

/**
 * Stonemate's sound: a slow, echoing hall tune in D minor on the menu and the gallery, a tenser part
 * while a game is on, and stings for a won or lost game. The capture scenes play the stone and rune
 * effects; the rules in `game/` stay free of sound.
 */

const held = (note: string) => `${note} ${'. '.repeat(15)}`.trim();

export const SONG: Song = {
  bpm: 84,
  mix: { lead: 0.09, harmony: 0.05, bass: 0.15, drums: 0.07 },
  waves: { lead: 'triangle', harmony: 'pulse25' },
  parts: {
    /** The menu and the capture gallery. */
    calm: {
      lead: [
        'd4 . . . f4 . a4 . . . g4 . f4 . . .',
        'e4 . . . g4 . bb4 . . . a4 . g4 . . .',
        'f4 . . . a4 . d5 . . . c5 . a4 . . .',
        'g4 . f4 . e4 . c#4 . d4 . . . - . . .',
      ].join(' | '),
      harmony: [held('a3'), held('bb3'), held('a3'), held('e3')].join(' | '),
      bass: [held('d2'), held('g2'), held('f2'), 'a2 . . . . . . . d2 . . . . . . .'].join(' | '),
      drums: 'k - - - - - - - h - - - - - - -',
    },
    /** A game under way. */
    battle: {
      lead: [
        'd5 . a4 . d5 . e5 . f5 . e5 . d5 . a4 .',
        'bb4 . f4 . bb4 . c5 . d5 . c5 . a4 . . .',
      ].join(' | '),
      harmony: [held('f4'), held('d4')].join(' | '),
      bass: ['d2 . d2 . a2 . d2 . d2 . d2 . a2 . c3 .', 'bb1 . bb1 . f2 . bb1 . a1 . a1 . e2 . a1 .'].join(' | '),
      drums: 'k - - h s - - h k - k h s - - h',
    },
    /** Sting: checkmate won. */
    win: {
      lead: 'd4 . f#4 . a4 . d5 . . . f#5 . . . . .',
      harmony: 'a3 . d4 . f#4 . a4 . . . d5 . . . . .',
      bass: 'd2 . . . . . . . d2 . . . . . . .',
      drums: 'k - - - s - - - k - - - - - - -',
    },
    /** Sting: checkmated. */
    lose: {
      lead: 'a4 . . . f4 . . . e4 . . . d4 . . .',
      bass: 'd2 . . . . . . . d1 . . . . . . .',
      drums: 'k - - - - - - - k - - - - - - -',
    },
  },
};

export const SFX = sounds({
  /** A statue shuffles or lands from a glide. */
  step: { wave: 'noise', freq: 900, to: 400, length: 0.07, volume: 0.12, gap: 80 },
  /** A knight lands hard. */
  stomp: { wave: 'noise', freq: 420, to: 90, length: 0.2, volume: 0.24, gap: 120 },
  /** A rook rams. */
  slam: { wave: 'noise', freq: 300, to: 70, length: 0.28, volume: 0.3, gap: 120 },
  /** A sword or a tap strikes stone. */
  chop: { wave: 'square', freq: 1400, to: 700, length: 0.08, volume: 0.16, gap: 80, vary: 0.05 },
  /** Stone cracks. */
  crack: { wave: 'noise', freq: 3400, to: 1200, length: 0.16, volume: 0.2, gap: 100 },
  /** A statue shatters. */
  shatter: { wave: 'noise', freq: 5200, to: 1500, length: 0.4, volume: 0.24, gap: 150 },
  /** Rubble tumbles down. */
  rubble: { wave: 'noise', freq: 600, to: 120, length: 0.5, volume: 0.24, gap: 150 },
  /** A rune bolt flies. */
  bolt: { wave: 'sine', freq: 600, to: 1500, length: 0.3, volume: 0.12, gap: 100 },
  /** A rune beam burns. */
  beam: { wave: 'sawtooth', freq: 220, to: 330, length: 0.5, volume: 0.08, gap: 150 },
  /** Two blows or spells meet. */
  clash: { wave: 'square', freq: 1800, arp: [0, 6], arpStep: 0.04, length: 0.18, volume: 0.16, gap: 120 },
  /** A statue gathers its rune light. */
  hum: { wave: 'triangle', freq: 180, to: 360, length: 0.3, volume: 0.14, gap: 150 },
  /** A piece picked up. */
  pick: { wave: 'triangle', freq: 660, length: 0.05, volume: 0.14 },
  /** A king in check. */
  check: { wave: 'pulse25', freq: 196, arp: [0, 6], arpStep: 0.12, length: 0.36, volume: 0.2, gap: 300 },
  /** A pawn promoted. */
  promote: { wave: 'triangle', freq: 523, arp: [0, 4, 7, 12], arpStep: 0.06, length: 0.36, volume: 0.24 },
});
